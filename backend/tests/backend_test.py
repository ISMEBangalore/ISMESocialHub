"""Regression tests for ISME Social Hub auth, clubs, submissions, posts, and dashboard APIs."""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")

CREDS_PATH = Path("/app/memory/test_credentials.md")
CREDS_TEXT = CREDS_PATH.read_text(encoding="utf-8") if CREDS_PATH.exists() else ""
ADMIN_EMAIL = re.search(r"Email: `([^`]+)`", CREDS_TEXT).group(1) if re.search(r"Email: `([^`]+)`", CREDS_TEXT) else None
ADMIN_PASSWORD = re.search(r"Password: `([^`]+)`", CREDS_TEXT).group(1) if re.search(r"Password: `([^`]+)`", CREDS_TEXT) else None


@pytest.fixture(scope="session")
def api():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    yield session
    session.close()


@pytest.fixture(scope="session")
def admin_auth(api):
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        pytest.skip("Admin credentials missing from /app/memory/test_credentials.md")
    response = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if response.status_code != 200:
        pytest.fail(f"Admin authentication failed: {response.status_code} {response.text[:500]}")
    data = response.json()
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "admin"
    assert isinstance(data["token"], str) and data["token"]
    return {"Authorization": f"Bearer {data['token']}"}, data


@pytest.fixture(scope="session")
def member_auth(api):
    email = f"test_member_{int(time.time())}_{uuid.uuid4().hex[:6]}@isme.in"
    password = "MemberTest#2026"
    response = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password, "name": "TEST API Member"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["user"]["email"] == email
    assert data["user"]["name"] == "TEST API Member"
    assert data["user"]["role"] == "member"
    assert isinstance(data["token"], str) and data["token"]
    return {"Authorization": f"Bearer {data['token']}"}, data, password


class TestHealthAndAuth:
    """Service health, registration, login, identity, cookie, lockout, and CORS checks."""

    def test_health(self, api):
        response = api.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        assert response.json() == {"service": "ISME Social Hub", "status": "ok"}

    def test_claim_seeded_connect_admin(self, api):
        payload = {"email": "connect@isme.in", "password": "ConnectTest#2026", "name": "TEST Connect Admin"}
        response = api.post(f"{BASE_URL}/api/auth/register", json=payload)
        if response.status_code == 400 and response.json().get("detail") == "Email already registered":
            login = api.post(f"{BASE_URL}/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
            pytest.fail(f"Seeded connect admin was already claimed before this test; claim flow could not be verified. Login status={login.status_code}")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["user"]["email"] == payload["email"]
        assert data["user"]["name"] == payload["name"]
        assert data["user"]["role"] == "admin"
        assert isinstance(data["token"], str) and data["token"]

    def test_member_registration_and_correct_login(self, api, member_auth):
        _, registered, password = member_auth
        email = registered["user"]["email"]
        response = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "member"
        assert isinstance(data["token"], str) and len(data["token"]) > 20

    def test_wrong_password_returns_401(self, api, admin_auth):
        response = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "definitely-wrong"})
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"

    def test_auth_me_with_and_without_token(self, api, admin_auth):
        headers, login_data = admin_auth
        authorized = api.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert authorized.status_code == 200
        assert authorized.json()["id"] == login_data["user"]["id"]
        assert authorized.json()["role"] == "admin"
        unauthorized = api.get(f"{BASE_URL}/api/auth/me")
        assert unauthorized.status_code == 401
        assert unauthorized.json()["detail"] == "Not authenticated"

    def test_password_hash_is_bcrypt_2b(self, member_auth):
        _, registered, _ = member_auth
        mongo_url = backend_env.get("MONGO_URL")
        db_name = backend_env.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("Mongo configuration unavailable for hash format verification")
        client = MongoClient(mongo_url)
        try:
            user = client[db_name].users.find_one({"email": registered["user"]["email"]})
            assert user and isinstance(user.get("password_hash"), str)
            assert user["password_hash"].startswith("$2b$")
        finally:
            client.close()

    def test_login_sets_application_httponly_cookie(self, api, admin_auth):
        response = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert response.status_code == 200
        cookies = response.headers.get("Set-Cookie", "")
        assert "access_token=" in cookies and "HttpOnly" in cookies, f"Application auth cookie missing: {cookies}"

    def test_brute_force_lockout_after_five_failures(self, api, member_auth):
        _, registered, _ = member_auth
        email = registered["user"]["email"]
        statuses = []
        for _ in range(6):
            response = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "WrongPass#2026"})
            statuses.append(response.status_code)
        assert statuses[:5] == [401] * 5
        assert statuses[5] in (423, 429), f"No lockout/rate-limit after 5 failures: {statuses}"

    def test_cors_credentials_use_explicit_frontend_origin(self, api):
        origin = BASE_URL
        response = api.options(
            f"{BASE_URL}/api/auth/login",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"


class TestClubAuthorizationAndCrud:
    """Public club reads, admin-only write enforcement, and full club CRUD persistence."""

    def test_clubs_public_and_writes_enforced(self, api, member_auth):
        public = api.get(f"{BASE_URL}/api/clubs")
        assert public.status_code == 200 and isinstance(public.json(), list)
        payload = {"name": "TEST Forbidden Club", "brand_color": "#123456", "status": "active"}
        none = api.post(f"{BASE_URL}/api/clubs", json=payload)
        member = api.post(f"{BASE_URL}/api/clubs", json=payload, headers=member_auth[0])
        assert none.status_code == 401 and none.json()["detail"] == "Not authenticated"
        assert member.status_code == 403 and member.json()["detail"] == "Admin access required"

    def test_admin_club_create_update_delete(self, api, admin_auth):
        headers = admin_auth[0]
        payload = {
            "name": f"TEST Club {uuid.uuid4().hex[:8]}", "description": "TEST initial", "logo_url": "",
            "lead_name": "TEST Lead", "lead_email": "lead@example.test", "instagram": "@testclub",
            "linkedin": "testclub", "twitter": "@testclub", "youtube": "testclub", "facebook": "testclub",
            "brand_color": "#123456", "status": "active"
        }
        created = api.post(f"{BASE_URL}/api/clubs", json=payload, headers=headers)
        assert created.status_code == 200, created.text
        club = created.json()
        assert isinstance(club["id"], str) and club["name"] == payload["name"] and club["brand_color"] == "#123456"
        club_id = club["id"]
        try:
            fetched = api.get(f"{BASE_URL}/api/clubs/{club_id}")
            assert fetched.status_code == 200 and fetched.json()["description"] == "TEST initial"
            updated_payload = {**payload, "description": "TEST updated", "status": "inactive", "brand_color": "#654321"}
            updated = api.put(f"{BASE_URL}/api/clubs/{club_id}", json=updated_payload, headers=headers)
            assert updated.status_code == 200
            assert updated.json()["description"] == "TEST updated" and updated.json()["status"] == "inactive"
            persisted = api.get(f"{BASE_URL}/api/clubs/{club_id}")
            assert persisted.json()["brand_color"] == "#654321"
        finally:
            deleted = api.delete(f"{BASE_URL}/api/clubs/{club_id}", headers=headers)
            assert deleted.status_code == 200 and deleted.json() == {"deleted": True}
        assert api.get(f"{BASE_URL}/api/clubs/{club_id}").status_code == 404


class TestSubmissionReviewConvertWorkflow:
    """Public submission ownership rules, admin review, email-disabled triggers, and conversion linkage."""

    def test_submission_workflow_and_convert(self, api, admin_auth, member_auth):
        headers = admin_auth[0]
        email = f"test_submitter_{uuid.uuid4().hex[:8]}@example.test"
        missing_club = {
            "submitter_name": "TEST Club Rep", "submitter_email": email, "submitter_role": "Club",
            "title": "TEST Missing Club", "content": "TEST", "suggested_platform": "Instagram", "post_type": "Post", "priority": "medium"
        }
        invalid = api.post(f"{BASE_URL}/api/submissions", json=missing_club)
        assert invalid.status_code == 400 and "club_id is required" in invalid.json()["detail"]

        payload = {
            "submitter_name": "TEST Student", "submitter_email": email, "submitter_role": "Student", "club_id": None,
            "title": f"TEST E2E Submission {uuid.uuid4().hex[:6]}", "content": "TEST original brief",
            "suggested_platform": "LinkedIn", "post_type": "Article", "media_url": "", "publish_by": "2026-09-15", "priority": "high"
        }
        created = api.post(f"{BASE_URL}/api/submissions", json=payload)
        assert created.status_code == 200, created.text
        sub = created.json(); sub_id = sub["id"]
        assert isinstance(sub_id, str) and sub["status"] == "pending" and sub["post_id"] is None

        mine = api.get(f"{BASE_URL}/api/submissions/mine", params={"email": email.upper()})
        assert mine.status_code == 200 and any(x["id"] == sub_id for x in mine.json())
        direct = api.get(f"{BASE_URL}/api/submissions/{sub_id}", params={"email": email})
        assert direct.status_code == 200 and direct.json()["title"] == payload["title"]
        mismatch = api.get(f"{BASE_URL}/api/submissions/{sub_id}", params={"email": "other@example.test"})
        assert mismatch.status_code == 404

        own_update = api.put(f"{BASE_URL}/api/submissions/{sub_id}/self", params={"email": email}, json={"title": payload["title"] + " Updated", "priority": "low"})
        assert own_update.status_code == 200
        assert own_update.json()["title"].endswith("Updated") and own_update.json()["priority"] == "low"
        assert api.get(f"{BASE_URL}/api/submissions/{sub_id}", params={"email": email}).json()["title"].endswith("Updated")

        no_admin = api.get(f"{BASE_URL}/api/admin/submissions", params={"status": "pending"})
        member = api.get(f"{BASE_URL}/api/admin/submissions", params={"status": "pending"}, headers=member_auth[0])
        assert no_admin.status_code == 401 and member.status_code == 403
        pending = api.get(f"{BASE_URL}/api/admin/submissions", params={"status": "pending"}, headers=headers)
        assert pending.status_code == 200 and any(x["id"] == sub_id for x in pending.json())

        non_approved_convert = api.post(f"{BASE_URL}/api/admin/submissions/{sub_id}/convert", headers=headers)
        assert non_approved_convert.status_code == 400
        reviewed = api.post(f"{BASE_URL}/api/admin/submissions/{sub_id}/review", headers=headers, json={"status": "approved", "review_notes": "TEST approved note"})
        assert reviewed.status_code == 200
        reviewed_data = reviewed.json()
        assert reviewed_data["status"] == "approved" and reviewed_data["review_notes"] == "TEST approved note"
        assert reviewed_data["reviewer_email"] == ADMIN_EMAIL

        blocked = api.put(f"{BASE_URL}/api/submissions/{sub_id}/self", params={"email": email}, json={"content": "must not save"})
        assert blocked.status_code == 403 and "Cannot edit" in blocked.json()["detail"]

        converted = api.post(f"{BASE_URL}/api/admin/submissions/{sub_id}/convert", headers=headers)
        assert converted.status_code == 200, converted.text
        post = converted.json(); post_id = post["id"]
        assert post["status"] == "scheduled" and post["submission_id"] == sub_id and post["title"].endswith("Updated")
        linked_sub = api.get(f"{BASE_URL}/api/submissions/{sub_id}", params={"email": email}).json()
        assert linked_sub["status"] == "published" and linked_sub["post_id"] == post_id
        fetched_post = api.get(f"{BASE_URL}/api/posts/{post_id}")
        assert fetched_post.status_code == 200 and fetched_post.json()["submission_id"] == sub_id
        deleted = api.delete(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
        assert deleted.status_code == 200 and deleted.json()["deleted"] is True
        assert api.get(f"{BASE_URL}/api/posts/{post_id}").status_code == 404


class TestPostsAndDashboard:
    """Post filter/CRUD authorization and dashboard response contract."""

    def test_post_crud_filters_and_authorization(self, api, admin_auth, member_auth):
        headers = admin_auth[0]
        payload = {
            "title": f"TEST Post {uuid.uuid4().hex[:8]}", "content": "TEST post content", "club_id": None,
            "platform": "Instagram", "post_type": "Carousel", "media_url": "", "live_url": "", "status": "draft",
            "scheduled_date": "2026-10-01", "published_date": None, "tags": ["TEST"], "likes": 1, "comments": 2, "shares": 3,
            "submission_id": None
        }
        assert api.post(f"{BASE_URL}/api/posts", json=payload).status_code == 401
        assert api.post(f"{BASE_URL}/api/posts", json=payload, headers=member_auth[0]).status_code == 403
        created = api.post(f"{BASE_URL}/api/posts", json=payload, headers=headers)
        assert created.status_code == 200
        post = created.json(); post_id = post["id"]
        assert post["title"] == payload["title"] and post["likes"] == 1
        try:
            filtered = api.get(f"{BASE_URL}/api/posts", params={"platform": "Instagram", "status": "draft"})
            assert filtered.status_code == 200 and any(p["id"] == post_id for p in filtered.json())
            excluded = api.get(f"{BASE_URL}/api/posts", params={"platform": "YouTube"})
            assert all(p["id"] != post_id for p in excluded.json())
            update_payload = {**payload, "status": "published", "published_date": "2026-07-20", "content": "TEST updated post"}
            updated = api.put(f"{BASE_URL}/api/posts/{post_id}", json=update_payload, headers=headers)
            assert updated.status_code == 200 and updated.json()["status"] == "published"
            persisted = api.get(f"{BASE_URL}/api/posts/{post_id}")
            assert persisted.json()["content"] == "TEST updated post" and persisted.json()["published_date"] == "2026-07-20"
        finally:
            deleted = api.delete(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
            assert deleted.status_code == 200
        assert api.get(f"{BASE_URL}/api/posts/{post_id}").status_code == 404

    def test_dashboard_contract_and_authorization(self, api, admin_auth, member_auth):
        assert api.get(f"{BASE_URL}/api/admin/dashboard").status_code == 401
        assert api.get(f"{BASE_URL}/api/admin/dashboard", headers=member_auth[0]).status_code == 403
        response = api.get(f"{BASE_URL}/api/admin/dashboard", headers=admin_auth[0])
        assert response.status_code == 200
        data = response.json()
        for key in ("pending_submissions", "approved_submissions", "rejected_submissions", "total_posts", "published_this_month", "scheduled"):
            assert isinstance(data[key], int) and data[key] >= 0
        assert isinstance(data["by_platform"], list)
        assert all(isinstance(row.get("count"), int) and "platform" in row for row in data["by_platform"])
        assert isinstance(data["by_club"], list)
        assert all({"club_id", "club_name", "brand_color", "count"}.issubset(row) for row in data["by_club"])
