from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import html
import logging
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

import newsletter_agents as agents

# Optional Resend import
try:
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY", "")
except Exception:
    resend = None

# -----------------------
# Config
# -----------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
SEED_ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("SEED_ADMIN_EMAILS", "").split(",") if e.strip()]
SEED_COADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("SEED_COADMIN_EMAILS", "").split(",") if e.strip()]
ADMIN_ROLES = ("admin", "co_admin")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("isme_hub")

app = FastAPI(title="ISME Social Hub")
api = APIRouter(prefix="/api")

# -----------------------
# Helpers
# -----------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def sanitize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "member"),
        "created_at": u.get("created_at"),
    }

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def send_email_async(to: str, subject: str, html: str):
    """Non-blocking email send. Silently no-ops if RESEND_API_KEY is not set."""
    key = os.environ.get("RESEND_API_KEY", "")
    if not key or resend is None:
        logger.info(f"[EMAIL DISABLED] to={to} subject={subject}")
        return
    try:
        resend.api_key = key
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"[EMAIL SENT] to={to} subject={subject}")
    except Exception as e:
        logger.error(f"[EMAIL FAILED] to={to} subject={subject} err={e}")

def email_template(title: str, body_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; background:#FAFAFA; padding:24px;">
  <table style="max-width:600px; margin:auto; background:#FFFFFF; border:2px solid #18181B; border-radius:12px;">
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 12px 0; color:#0A0A0A; font-size:22px;">{title}</h1>
      <div style="color:#3F3F46; font-size:15px; line-height:1.6;">{body_html}</div>
      <p style="margin-top:24px; font-size:12px; color:#71717A;">— ISME Social Hub, Bangalore</p>
    </td></tr>
  </table>
</body></html>
"""

# -----------------------
# Models
# -----------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)

class ClubIn(BaseModel):
    name: str
    description: str = ""
    logo_url: str = ""
    lead_name: str = ""
    lead_email: Optional[EmailStr] = None
    faculty_incharge: str = ""
    student_coordinator: str = ""
    social_media_coordinator: str = ""
    instagram: str = ""
    linkedin: str = ""
    twitter: str = ""
    youtube: str = ""
    facebook: str = ""
    brand_color: str = "#3B82F6"
    status: Literal["active", "inactive"] = "active"
    type: Literal["club", "event", "house"] = "club"

class CalendarEventIn(BaseModel):
    date: str  # ISO date string, "YYYY-MM-DD"
    activity: str
    audience: List[str] = Field(default_factory=list)
    academic_year: str = ""
    source: str = "SDC"

class SubmissionIn(BaseModel):
    submitter_name: str
    submitter_email: EmailStr
    submitter_role: Literal["Club", "Student", "Faculty", "Event", "House"]
    club_id: Optional[str] = None
    title: str
    content: str
    suggested_platform: Literal["Instagram", "LinkedIn", "Twitter", "YouTube", "Facebook"]
    post_type: Literal["Reel", "Carousel", "Story", "Post", "Video", "Article"]
    media_url: str = ""
    publish_by: Optional[str] = None  # ISO date string
    priority: Literal["low", "medium", "high"] = "medium"

class SubmissionUpdateOwn(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    suggested_platform: Optional[str] = None
    post_type: Optional[str] = None
    media_url: Optional[str] = None
    publish_by: Optional[str] = None
    priority: Optional[str] = None

class SubmissionReview(BaseModel):
    status: Literal["in_review", "approved", "rejected"]
    review_notes: str = ""

class PostIn(BaseModel):
    title: str
    content: str = ""
    club_id: Optional[str] = None
    platform: Literal["Instagram", "LinkedIn", "Twitter", "YouTube", "Facebook"]
    post_type: Literal["Reel", "Carousel", "Story", "Post", "Video", "Article"]
    media_url: str = ""
    live_url: str = ""
    status: Literal["draft", "scheduled", "published", "review"] = "draft"
    scheduled_date: Optional[str] = None
    published_date: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    likes: int = 0
    comments: int = 0
    shares: int = 0
    submission_id: Optional[str] = None

class NewsletterItemEdit(BaseModel):
    headline: str
    blurb: str
    source_url: str = ""

class NewsletterHighlightEdit(BaseModel):
    text: str
    source_url: str = ""

class NewsletterContentEdit(BaseModel):
    subject_line: str
    intro: str
    items: List[NewsletterItemEdit]
    skill_takeaway: str = ""
    homepage_highlights: List[NewsletterHighlightEdit]

class NewsletterReject(BaseModel):
    reason: str = ""

# -----------------------
# Startup
# -----------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.submissions.create_index("submitter_email")
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.newsletter_runs.create_index("created_at")
    # Seed admin / co-admin accounts (unclaimed - no password_hash)
    for email, role in [(e, "admin") for e in SEED_ADMIN_EMAILS] + [(e, "co_admin") for e in SEED_COADMIN_EMAILS]:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email,
                "name": email.split("@")[0],
                "role": role,
                "password_hash": None,  # unclaimed
                "created_at": now_iso(),
            })
            logger.info(f"Seeded {role} (unclaimed): {email}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# -----------------------
# Auth Endpoints
# -----------------------
@api.get("/")
async def root():
    return {"service": "ISME Social Hub", "status": "ok"}

@api.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        # Allow claiming an unclaimed seeded admin account
        if existing.get("password_hash") is None:
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "password_hash": hash_password(payload.password),
                    "name": payload.name,
                    "claimed_at": now_iso(),
                }},
            )
            user = await db.users.find_one({"email": email}, {"_id": 0})
            token = create_access_token(user["id"], user["email"], user["role"])
            return {"user": sanitize_user(user), "token": token}
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name,
        "role": "member",
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, "member")
    return {"user": sanitize_user(doc), "token": token}

@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("password_hash"):
        raise HTTPException(status_code=403, detail="Account not claimed. Please register to set your password.")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], user["email"], user["role"])
    return {"user": sanitize_user(user), "token": token}

@api.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return sanitize_user(current)

@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "expires_at": expires_at,
            "used": False,
        })
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        logger.info(f"[PASSWORD RESET] {email}: {reset_link}")
        body = f"<p>Someone requested a password reset for your ISME Social Hub account.</p><p><a href='{reset_link}' style='background:#3B82F6; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; display:inline-block;'>Reset Password</a></p><p>Link expires in 1 hour. If you didn't ask for this, ignore this email.</p>"
        await send_email_async(email, "Reset your ISME Social Hub password", email_template("Password Reset", body))
    return {"message": "If an account exists for that email, a reset link was sent."}

@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    record = await db.password_reset_tokens.find_one({"token": payload.token})
    if not record or record.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or used token")
    exp = record["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one(
        {"id": record["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}}
    )
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"message": "Password reset successful"}

# -----------------------
# Clubs
# -----------------------
@api.get("/clubs")
async def list_clubs(status: Optional[str] = None, type: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    if type:
        # Docs created before the `type` field existed are clubs by default.
        q["type"] = {"$in": [type, None]} if type == "club" else type
    docs = await db.clubs.find(q, {"_id": 0}).sort("name", 1).to_list(500)
    return docs

@api.get("/clubs/{club_id}")
async def get_club(club_id: str):
    doc = await db.clubs.find_one({"id": club_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Club not found")
    return doc

@api.post("/clubs")
async def create_club(payload: ClubIn, admin: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.clubs.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/clubs/{club_id}")
async def update_club(club_id: str, payload: ClubIn, admin: dict = Depends(require_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    result = await db.clubs.update_one({"id": club_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Club not found")
    doc = await db.clubs.find_one({"id": club_id}, {"_id": 0})
    return doc

@api.delete("/clubs/{club_id}")
async def delete_club(club_id: str, admin: dict = Depends(require_admin)):
    result = await db.clubs.delete_one({"id": club_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Club not found")
    return {"deleted": True}

# -----------------------
# Calendar
# -----------------------
@api.get("/calendar")
async def list_calendar(from_date: Optional[str] = None, to_date: Optional[str] = None, audience: Optional[str] = None):
    q = {}
    if from_date or to_date:
        q["date"] = {}
        if from_date:
            q["date"]["$gte"] = from_date
        if to_date:
            q["date"]["$lte"] = to_date
    if audience:
        q["audience"] = audience
    docs = await db.calendar_events.find(q, {"_id": 0}).sort("date", 1).to_list(1000)
    return docs

@api.post("/calendar")
async def create_calendar_event(payload: CalendarEventIn, admin: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.calendar_events.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/calendar/{event_id}")
async def update_calendar_event(event_id: str, payload: CalendarEventIn, admin: dict = Depends(require_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    result = await db.calendar_events.update_one({"id": event_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Calendar event not found")
    doc = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
    return doc

@api.delete("/calendar/{event_id}")
async def delete_calendar_event(event_id: str, admin: dict = Depends(require_admin)):
    result = await db.calendar_events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Calendar event not found")
    return {"deleted": True}

# -----------------------
# Submissions
# -----------------------
@api.post("/submissions")
async def create_submission(payload: SubmissionIn):
    if payload.submitter_role in ("Club", "Event", "House") and not payload.club_id:
        raise HTTPException(400, f"club_id is required when submitter_role is '{payload.submitter_role}'")
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["submitter_email"] = doc["submitter_email"].lower()
    doc["status"] = "pending"
    doc["review_notes"] = ""
    doc["reviewer_id"] = None
    doc["reviewer_email"] = None
    doc["post_id"] = None
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.submissions.insert_one(doc)
    doc.pop("_id", None)

    # Email notifications (fire and forget)
    admins = await db.users.find({"role": {"$in": list(ADMIN_ROLES)}}, {"_id": 0, "email": 1}).to_list(50)
    admin_emails = [a["email"] for a in admins if a.get("email")]
    body_admin = f"<p>New submission: <b>{doc['title']}</b></p><p>From: {doc['submitter_name']} ({doc['submitter_email']}) — {doc['submitter_role']}</p><p>Platform: {doc['suggested_platform']} · {doc['post_type']} · Priority: {doc['priority']}</p><p><a href='{FRONTEND_URL}/review'>Review in dashboard</a></p>"
    for ae in admin_emails:
        asyncio.create_task(send_email_async(ae, f"New submission: {doc['title']}", email_template("New Submission", body_admin)))
    body_sub = f"<p>Thanks {doc['submitter_name']}! We received your submission <b>{doc['title']}</b>.</p><p>You can track its status here:</p><p><a href='{FRONTEND_URL}/track?id={doc['id']}&email={doc['submitter_email']}'>Track submission</a></p>"
    asyncio.create_task(send_email_async(doc["submitter_email"], "We received your ISME submission", email_template("Submission Received", body_sub)))
    return doc

@api.get("/submissions/mine")
async def my_submissions(email: EmailStr = Query(...)):
    docs = await db.submissions.find({"submitter_email": email.lower()}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api.get("/submissions/{submission_id}")
async def get_submission_public(submission_id: str, email: EmailStr = Query(...)):
    doc = await db.submissions.find_one({"id": submission_id, "submitter_email": email.lower()}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Submission not found")
    return doc

@api.put("/submissions/{submission_id}/self")
async def update_own_submission(submission_id: str, payload: SubmissionUpdateOwn, email: EmailStr = Query(...)):
    sub = await db.submissions.find_one({"id": submission_id, "submitter_email": email.lower()})
    if not sub:
        raise HTTPException(404, "Submission not found")
    if sub.get("status") != "pending":
        raise HTTPException(403, "Cannot edit once review has started")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.submissions.update_one({"id": submission_id}, {"$set": update})
    doc = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    return doc

# Admin submissions list
@api.get("/admin/submissions")
async def admin_list_submissions(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    docs = await db.submissions.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/admin/submissions/{submission_id}/review")
async def review_submission(submission_id: str, payload: SubmissionReview, admin: dict = Depends(require_admin)):
    sub = await db.submissions.find_one({"id": submission_id})
    if not sub:
        raise HTTPException(404, "Submission not found")
    update = {
        "status": payload.status,
        "review_notes": payload.review_notes,
        "reviewer_id": admin["id"],
        "reviewer_email": admin["email"],
        "updated_at": now_iso(),
    }
    await db.submissions.update_one({"id": submission_id}, {"$set": update})
    doc = await db.submissions.find_one({"id": submission_id}, {"_id": 0})

    # notify submitter
    status_labels = {"in_review": "under review", "approved": "approved", "rejected": "rejected"}
    label = status_labels.get(payload.status, payload.status)
    color = {"approved": "#22C55E", "rejected": "#F43F5E", "in_review": "#EAB308"}.get(payload.status, "#3B82F6")
    notes_html = f"<p><b>Notes:</b> {payload.review_notes}</p>" if payload.review_notes else ""
    body = f"<p>Your submission <b>{sub.get('title')}</b> is now <span style='background:{color}; color:#fff; padding:4px 10px; border-radius:20px; font-weight:600;'>{label}</span>.</p>{notes_html}<p><a href='{FRONTEND_URL}/track?id={sub['id']}&email={sub['submitter_email']}'>View submission</a></p>"
    asyncio.create_task(send_email_async(sub["submitter_email"], f"Update on '{sub.get('title')}'", email_template("Submission Update", body)))
    return doc

@api.post("/admin/submissions/{submission_id}/convert")
async def convert_submission_to_post(submission_id: str, admin: dict = Depends(require_admin)):
    sub = await db.submissions.find_one({"id": submission_id})
    if not sub:
        raise HTTPException(404, "Submission not found")
    if sub.get("status") != "approved":
        raise HTTPException(400, "Submission must be approved before converting to post")
    post_id = str(uuid.uuid4())
    post_doc = {
        "id": post_id,
        "title": sub.get("title"),
        "content": sub.get("content", ""),
        "club_id": sub.get("club_id"),
        "platform": sub.get("suggested_platform"),
        "post_type": sub.get("post_type"),
        "media_url": sub.get("media_url", ""),
        "live_url": "",
        "status": "scheduled",
        "scheduled_date": sub.get("publish_by"),
        "published_date": None,
        "author_id": admin["id"],
        "author_email": admin["email"],
        "tags": [],
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "submission_id": submission_id,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.posts.insert_one(post_doc)
    await db.submissions.update_one(
        {"id": submission_id},
        {"$set": {"status": "published", "post_id": post_id, "updated_at": now_iso()}},
    )
    post_doc.pop("_id", None)
    body = f"<p>Great news! Your submission <b>{sub.get('title')}</b> has been scheduled for publishing.</p><p>Platform: {post_doc['platform']}</p>"
    asyncio.create_task(send_email_async(sub["submitter_email"], f"'{sub.get('title')}' is scheduled", email_template("Scheduled", body)))
    return post_doc

# -----------------------
# Posts
# -----------------------
@api.get("/posts")
async def list_posts(club_id: Optional[str] = None, platform: Optional[str] = None, status: Optional[str] = None):
    q = {}
    if club_id: q["club_id"] = club_id
    if platform: q["platform"] = platform
    if status: q["status"] = status
    docs = await db.posts.find(q, {"_id": 0}).sort("scheduled_date", -1).to_list(500)
    return docs

@api.get("/posts/{post_id}")
async def get_post(post_id: str):
    doc = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Post not found")
    return doc

@api.post("/posts")
async def create_post(payload: PostIn, admin: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["author_id"] = admin["id"]
    doc["author_email"] = admin["email"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/posts/{post_id}")
async def update_post(post_id: str, payload: PostIn, admin: dict = Depends(require_admin)):
    update = payload.model_dump()
    update["updated_at"] = now_iso()
    result = await db.posts.update_one({"id": post_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Post not found")
    doc = await db.posts.find_one({"id": post_id}, {"_id": 0})
    return doc

@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, admin: dict = Depends(require_admin)):
    r = await db.posts.delete_one({"id": post_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Post not found")
    return {"deleted": True}

# -----------------------
# Dashboard
# -----------------------
@api.get("/admin/dashboard")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    pending = await db.submissions.count_documents({"status": {"$in": ["pending", "in_review"]}})
    approved = await db.submissions.count_documents({"status": "approved"})
    rejected = await db.submissions.count_documents({"status": "rejected"})
    total_posts = await db.posts.count_documents({})
    # posts published this month
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    published_this_month = await db.posts.count_documents({
        "status": "published",
        "published_date": {"$gte": start_of_month.isoformat()},
    })
    scheduled = await db.posts.count_documents({"status": "scheduled"})
    posts_published_total = await db.posts.count_documents({"status": "published"})
    houses_count = await db.clubs.count_documents({"type": "house"})
    clubs_count = await db.clubs.count_documents({"type": "club"})
    sdc_events_count = await db.calendar_events.count_documents({})

    # breakdown by platform
    platform_pipeline = [
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
        {"$project": {"platform": "$_id", "count": 1, "_id": 0}},
    ]
    by_platform = await db.posts.aggregate(platform_pipeline).to_list(20)

    # breakdown by club
    club_pipeline = [
        {"$group": {"_id": "$club_id", "count": {"$sum": 1}}},
    ]
    by_club_raw = await db.posts.aggregate(club_pipeline).to_list(50)
    clubs = await db.clubs.find({}, {"_id": 0, "id": 1, "name": 1, "brand_color": 1}).to_list(200)
    club_map = {c["id"]: c for c in clubs}
    by_club = []
    for row in by_club_raw:
        cid = row["_id"]
        c = club_map.get(cid)
        by_club.append({
            "club_id": cid,
            "club_name": c["name"] if c else ("Unassigned" if cid is None else "Unknown"),
            "brand_color": c["brand_color"] if c else "#71717A",
            "count": row["count"],
        })

    return {
        "pending_submissions": pending,
        "approved_submissions": approved,
        "rejected_submissions": rejected,
        "total_posts": total_posts,
        "published_this_month": published_this_month,
        "scheduled": scheduled,
        "posts_published_total": posts_published_total,
        "houses_count": houses_count,
        "clubs_count": clubs_count,
        "sdc_events_count": sdc_events_count,
        "by_platform": by_platform,
        "by_club": by_club,
    }

# -----------------------
# AI Newsletter Pipeline
# -----------------------
NEWSLETTER_MAX_REVISIONS = 1  # cap the Content<->Evaluation correction loop

def render_newsletter_body_html(content: dict, public_url: str) -> str:
    """Renders the structured content agent output into the branded HTML used for
    both the email body and the public newsletter page - one template, two uses,
    so the AI never hand-authors markup."""
    parts = [f"<p style='font-size:16px;'>{html.escape(content.get('intro', ''))}</p>"]
    for item in content.get("items", []):
        parts.append(f"""
<div style="margin:20px 0; padding-left:16px; border-left:3px solid #3B82F6;">
  <h3 style="margin:0 0 6px 0; font-size:17px; color:#0A0A0A;">{html.escape(item.get('headline', ''))}</h3>
  <p style="margin:0 0 6px 0;">{html.escape(item.get('blurb', ''))}</p>
  <a href="{html.escape(item.get('source_url', ''), quote=True)}" style="font-size:13px; color:#3B82F6;">Read the source &rarr;</a>
</div>""")
    takeaway = content.get("skill_takeaway", "")
    if takeaway:
        parts.append(f"""
<div style="margin-top:24px; padding:16px; background:#FEF9C3; border-radius:8px;">
  <b>Skill takeaway:</b> {html.escape(takeaway)}
</div>""")
    parts.append(f"""<p style="margin-top:28px; font-size:13px;"><a href="{html.escape(public_url, quote=True)}" style="color:#3B82F6;">View this newsletter online</a></p>""")
    return "".join(parts)

async def _send_single_newsletter_email(to: str, subject: str, html_body: str) -> dict:
    key = os.environ.get("RESEND_API_KEY", "")
    if not key or resend is None:
        return {"to": to, "ok": False, "reason": "email_disabled"}
    try:
        resend.api_key = key
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html_body}
        await asyncio.to_thread(resend.Emails.send, params)
        return {"to": to, "ok": True}
    except Exception as e:
        return {"to": to, "ok": False, "reason": str(e)}

async def send_newsletter_email_blast(subject: str, html_body: str) -> dict:
    recipients = await db.users.find({}, {"_id": 0, "email": 1}).to_list(5000)
    emails = [r["email"] for r in recipients if r.get("email")]
    if not emails:
        return {"attempted": 0, "succeeded": 0, "results": []}
    results = await asyncio.gather(*[_send_single_newsletter_email(e, subject, html_body) for e in emails])
    succeeded = sum(1 for r in results if r.get("ok"))
    logger.info(f"[NEWSLETTER EMAIL BLAST] sent={succeeded}/{len(emails)}")
    return {"attempted": len(emails), "succeeded": succeeded, "results": results}

async def run_newsletter_pipeline(run_id: str):
    async def update(fields: dict):
        fields["updated_at"] = now_iso()
        await db.newsletter_runs.update_one({"id": run_id}, {"$set": fields})

    try:
        await update({"status": "research_running"})
        today_iso = datetime.now(timezone.utc).date().isoformat()
        research_items = await agents.run_research_agent(today_iso)
        await update({"status": "content_running", "research_items": research_items})

        content = await agents.run_content_agent(research_items)
        await update({"status": "evaluation_running", "content": content, "content_original": content})

        evaluation = await agents.run_evaluation_agent(content, research_items)
        await update({"evaluation": evaluation})

        revision_count = 0
        while evaluation.get("overall_risk") == "high" and revision_count < NEWSLETTER_MAX_REVISIONS:
            revision_count += 1
            await update({"status": "revising", "revision_count": revision_count})
            content = await agents.run_content_agent(research_items, revision_notes=evaluation.get("flagged_claims", []))
            await update({"content": content, "content_original": content, "status": "evaluation_running"})
            evaluation = await agents.run_evaluation_agent(content, research_items)
            await update({"evaluation": evaluation})

        await update({"status": "ready_for_review"})
    except Exception as e:
        logger.error(f"[NEWSLETTER PIPELINE FAILED] run_id={run_id} err={e}")
        await update({"status": "failed", "error": str(e)})

@api.post("/admin/newsletter/runs")
async def create_newsletter_run(admin: dict = Depends(require_admin)):
    run_id = str(uuid.uuid4())
    doc = {
        "id": run_id,
        "status": "queued",
        "research_items": [],
        "content": None,
        "content_original": None,
        "evaluation": None,
        "revision_count": 0,
        "error": None,
        "triggered_by": admin["email"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "approved_by": None,
        "approved_at": None,
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
        "sent_at": None,
        "send_results": None,
        "approval_log": [],
    }
    await db.newsletter_runs.insert_one(doc)
    asyncio.create_task(run_newsletter_pipeline(run_id))
    doc.pop("_id", None)
    return doc

@api.get("/admin/newsletter/runs")
async def list_newsletter_runs(admin: dict = Depends(require_admin)):
    docs = await db.newsletter_runs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs

@api.get("/admin/newsletter/runs/{run_id}")
async def get_newsletter_run(run_id: str, admin: dict = Depends(require_admin)):
    doc = await db.newsletter_runs.find_one({"id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Newsletter run not found")
    return doc

@api.put("/admin/newsletter/runs/{run_id}/content")
async def edit_newsletter_content(run_id: str, payload: NewsletterContentEdit, admin: dict = Depends(require_admin)):
    run = await db.newsletter_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(404, "Newsletter run not found")
    if run.get("status") != "ready_for_review":
        raise HTTPException(400, "Can only edit content while the run is ready for review")
    # Merge rather than replace so fields the reviewer doesn't edit (e.g. sources_used)
    # survive - a wholesale replace would make every save look like an edit later.
    merged_content = {**(run.get("content") or {}), **payload.model_dump()}
    update = {"content": merged_content, "updated_at": now_iso()}
    await db.newsletter_runs.update_one({"id": run_id}, {"$set": update})
    doc = await db.newsletter_runs.find_one({"id": run_id}, {"_id": 0})
    return doc

@api.post("/admin/newsletter/runs/{run_id}/approve")
async def approve_newsletter_run(run_id: str, admin: dict = Depends(require_admin)):
    run = await db.newsletter_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(404, "Newsletter run not found")
    if run.get("status") != "ready_for_review":
        raise HTTPException(400, "Run is not ready for review")

    content = run.get("content") or {}
    original = run.get("content_original") or {}
    edits_made = content != original

    public_url = f"{FRONTEND_URL}/newsletter/{run_id}"
    subject = content.get("subject_line", "ISME AI Newsletter")
    html_body = email_template(subject, render_newsletter_body_html(content, public_url))
    email_result = await send_newsletter_email_blast(subject, html_body)

    highlights = "\n".join(f"- {h.get('text', '')}" for h in content.get("homepage_highlights", []))
    whatsapp_text = f"{highlights}\n\nRead the full newsletter: {public_url}"
    whatsapp_result = await agents.send_whatsapp_broadcast(whatsapp_text[:1500])

    approval_entry = {"date": now_iso(), "reviewer_email": admin["email"], "edits_made": edits_made}
    update = {
        "status": "sent",
        "approved_by": admin["email"],
        "approved_at": now_iso(),
        "sent_at": now_iso(),
        "send_results": {"email": email_result, "whatsapp": whatsapp_result},
        "updated_at": now_iso(),
    }
    await db.newsletter_runs.update_one({"id": run_id}, {"$set": update, "$push": {"approval_log": approval_entry}})
    doc = await db.newsletter_runs.find_one({"id": run_id}, {"_id": 0})
    return doc

@api.post("/admin/newsletter/runs/{run_id}/reject")
async def reject_newsletter_run(run_id: str, payload: NewsletterReject, admin: dict = Depends(require_admin)):
    run = await db.newsletter_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(404, "Newsletter run not found")
    if run.get("status") != "ready_for_review":
        raise HTTPException(400, "Run is not ready for review")
    update = {
        "status": "rejected",
        "rejected_by": admin["email"],
        "rejected_at": now_iso(),
        "rejection_reason": payload.reason,
        "updated_at": now_iso(),
    }
    approval_entry = {
        "date": now_iso(), "reviewer_email": admin["email"], "edits_made": False,
        "rejected": True, "reason": payload.reason,
    }
    await db.newsletter_runs.update_one({"id": run_id}, {"$set": update, "$push": {"approval_log": approval_entry}})
    doc = await db.newsletter_runs.find_one({"id": run_id}, {"_id": 0})
    return doc

# Public page for a sent newsletter (linked from the email / WhatsApp broadcast).
# Never exposes drafts - only a run that has actually been approved and sent.
@api.get("/newsletter/{run_id}")
async def get_public_newsletter(run_id: str):
    doc = await db.newsletter_runs.find_one({"id": run_id, "status": "sent"}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Newsletter not found")
    content = doc.get("content") or {}
    return {**content, "sent_at": doc.get("sent_at")}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
