"""Claude-powered agent chain for the ISME AI newsletter pipeline.

Three chained calls to the Anthropic Messages API (Research -> Content -> Evaluation).
Pure functions only - no DB or FastAPI dependencies, so this module can be imported
and unit-tested independently of server.py.
"""
import json
import logging
import os
import urllib.request
import urllib.error
from typing import Optional

logger = logging.getLogger("isme_hub.newsletter")

MODEL = "claude-opus-5"

try:
    import anthropic
except Exception:
    anthropic = None

_client = None


def get_client():
    global _client
    if anthropic is None:
        raise RuntimeError("The 'anthropic' package is not installed.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")
    if _client is None:
        # Org-level (not workspace-scoped) API keys require this header on every
        # request. Workspace-scoped keys don't need it - ANTHROPIC_WORKSPACE_ID
        # is optional and only relevant for the former.
        workspace_id = os.environ.get("ANTHROPIC_WORKSPACE_ID", "")
        default_headers = {"anthropic-workspace-id": workspace_id} if workspace_id else None
        _client = anthropic.Anthropic(default_headers=default_headers)
    return _client


def extract_json_object(text: str) -> dict:
    """Best-effort JSON object extraction. Structured outputs guarantee valid JSON
    in the first text block, but we defensively strip stray prose/fences anyway."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output")
    return json.loads(text[start:end + 1])


# -----------------------------------------------------------------------
# Agent 1 - Research
# -----------------------------------------------------------------------
RESEARCH_SYSTEM = """You are the research agent for ISME's weekly "AI & Management Education" newsletter.

Your job: gather this week's most relevant, verifiable developments on how AI is
changing (a) management/B-school education and (b) hiring for roles that recruit
from B-schools and IIMs - consulting, finance, marketing, operations, product,
analytics.

Vetting gate - before including any item, confirm it clearly connects to at
least one of: MBA/PGDM program or admissions changes, B-school curriculum or
opportunities, hiring/recruiting markets that draw from B-schools, or a market
shift that changes what a management aspirant needs to know or do. If a story
doesn't clearly connect to one of these, leave it out even if it's AI news.

For each source you find, output a structured record with these fields:
- headline: string
- source_name: string
- source_url: string
- publish_date: "YYYY-MM-DD"
- category: one of "education", "hiring", "policy", "company_move", "skill_trend"
- key_claim: one factual sentence - what actually happened, no interpretation
- relevance_to_bschool_audience: one sentence - why an MBA/PGDM student, parent,
  or recruiter would care
- confidence: "high" or "low" - use "low" whenever you are not fully confident
  in a detail rather than omitting the item silently

Rules:
- Use the web_search tool to find and verify real, current sources. Only include
  items actually published in the last 7 days before today's date (given below).
- Prioritize primary sources (company announcements, official reports, government
  releases) over aggregator articles.
- Do not editorialize or predict - record only what is verifiably reported.
- Return 8-12 items."""

RESEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            # No minItems/maxItems: structured-output array schemas only support
            # bounds of 0 or 1 - the 8-12 count is enforced by the prompt instead.
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "source_name": {"type": "string"},
                    "source_url": {"type": "string"},
                    "publish_date": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["education", "hiring", "policy", "company_move", "skill_trend"],
                    },
                    "key_claim": {"type": "string"},
                    "relevance_to_bschool_audience": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["high", "low"]},
                },
                "required": [
                    "headline", "source_name", "source_url", "publish_date",
                    "category", "key_claim", "relevance_to_bschool_audience", "confidence",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


async def run_research_agent(today_iso: str) -> list:
    client = get_client()
    response = await _create(
        client,
        system=RESEARCH_SYSTEM,
        user=f"Today's date is {today_iso}. Find this week's items and return the JSON.",
        schema=RESEARCH_SCHEMA,
        tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 15}],
        max_tokens=16000,
    )
    text = _first_text(response)
    data = extract_json_object(text)
    return data["items"]


# -----------------------------------------------------------------------
# Agent 2 - Content / Article & Homepage
# -----------------------------------------------------------------------
CONTENT_SYSTEM = """You are the content agent for ISME's weekly "AI & Management Education" newsletter.
You write in ISME's voice: informed, direct, credible - never hype-y, never alarmist.

Input: a JSON array of research items, each with a source_url and key_claim.

Produce STRUCTURED newsletter content (not prose with inline formatting - the
backend renders your fields into the actual page and email, so keep each field
plain text, no markdown/HTML):

- subject_line: under 60 characters, specific - not "This Week in AI"
- analysis: a short (4-6 sentence) lead analysis, in ISME's voice, that
  synthesizes the pattern(s) or connecting theme(s) across ALL of the
  research items provided - not just the ones you feature below. This runs
  at the top of the newsletter, above the individual items, as ISME's own
  read of the week. It must still trace every specific claim to a
  source_url from the input; it's a synthesis of what's there, not new
  commentary beyond it. It must end by explicitly answering, for an
  MBA/PGDM aspirant reading this: what this week's developments mean for
  them, and which specific skills they should focus on building as a
  result - only name a skill if the research genuinely points to it
  (e.g. a hiring pilot testing a specific competency, a curriculum change
  adding a specific subject); never invent a skill recommendation that
  isn't grounded in this week's items.
- intro: one sentence framing the week
- items: 4-6 entries, each:
  - headline: plain-language headline
  - blurb: 2-3 sentences - what happened and what it means for management
    students/B-school hires
  - source_url: the exact source_url this item's claims trace back to
- skill_takeaway: a concrete, non-speculative note on what this week's
  developments suggest is worth learning - only if the research genuinely
  supports it; return an empty string "" if it doesn't (do not force one)
- homepage_highlights: exactly 3 entries, each a short bullet for a web
  visitor skimming ({text, source_url}), source_url pointing at the item it
  summarizes
- sources_used: array of every source_url you actually cited above

Hard rules:
- Every factual claim must trace to a source_url from the input. Do not state
  anything not present in the research input.
- Do not use words like "will," "guaranteed," or "definitely" about future
  outcomes - use "early signal," "may indicate," "worth watching."
- Do not invent statistics, quotes, or company names."""

CONTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "subject_line": {"type": "string"},
        "analysis": {"type": "string"},
        "intro": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "headline": {"type": "string"},
                    "blurb": {"type": "string"},
                    "source_url": {"type": "string"},
                },
                "required": ["headline", "blurb", "source_url"],
                "additionalProperties": False,
            },
        },
        "skill_takeaway": {"type": "string"},
        "homepage_highlights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "source_url": {"type": "string"},
                },
                "required": ["text", "source_url"],
                "additionalProperties": False,
            },
        },
        "sources_used": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["subject_line", "analysis", "intro", "items", "skill_takeaway", "homepage_highlights", "sources_used"],
    "additionalProperties": False,
}


async def run_content_agent(research_items: list, revision_notes: Optional[list] = None) -> dict:
    client = get_client()
    user = f"Research items:\n{json.dumps(research_items, indent=2)}"
    if revision_notes:
        user += (
            "\n\nThe previous draft was flagged by the fact-check agent for these issues - "
            "revise the newsletter to fix every one of them (tighten language, remove or "
            "re-source unsupported claims, cut prohibited certainty words). Still cite only "
            f"from the research items above:\n{json.dumps(revision_notes, indent=2)}"
        )
    response = await _create(
        client,
        system=CONTENT_SYSTEM,
        user=user,
        schema=CONTENT_SCHEMA,
        max_tokens=16000,
    )
    return extract_json_object(_first_text(response))


# -----------------------------------------------------------------------
# Agent 3 - Evaluation / Authenticity Check
# -----------------------------------------------------------------------
EVAL_SYSTEM = """You are the fact-check and authenticity agent for ISME's AI newsletter pipeline.
You are the last automated check before human review - your job is to make the
human reviewer's job fast, not to approve content.

Input: the Content Agent's JSON output (analysis, intro, items[].blurb,
skill_takeaway, homepage_highlights[].text) AND the original Research Agent
JSON array.

For every factual claim in analysis, intro, each items[].blurb,
skill_takeaway, and each homepage_highlights[].text:
1. Locate the specific research item it should trace back to.
2. Mark it: "verified" (matches a research item exactly), "overstated" (research
   item exists but claim adds unsupported certainty/specificity), or "unsupported"
   (no matching research item found).
3. For any number, date, company name, or quote - check it character-for-character
   against the source research item.
4. Check tone: flag any sentence using prohibited certainty language
   ("will," "guaranteed," "definitely," "always") about future outcomes.

Only include an entry in flagged_claims for a claim marked "overstated",
"unsupported", or with a tone violation - do not list "verified" claims.

Return: overall_risk ("low", "medium", or "high"), flagged_claims (array of
{claim, issue: "overstated"|"unsupported"|"tone", detail, suggested_fix}),
citation_check (a sentence: are all sources_used present in the research input,
yes or no and why), recommendation ("approve_for_human_review" or
"revise_before_human_review").

Do not rewrite the content yourself - flag issues only. A human makes the final
edit and approval decision."""

EVAL_SCHEMA = {
    "type": "object",
    "properties": {
        "overall_risk": {"type": "string", "enum": ["low", "medium", "high"]},
        "flagged_claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "issue": {"type": "string", "enum": ["overstated", "unsupported", "tone"]},
                    "detail": {"type": "string"},
                    "suggested_fix": {"type": "string"},
                },
                "required": ["claim", "issue", "detail", "suggested_fix"],
                "additionalProperties": False,
            },
        },
        "citation_check": {"type": "string"},
        "recommendation": {"type": "string", "enum": ["approve_for_human_review", "revise_before_human_review"]},
    },
    "required": ["overall_risk", "flagged_claims", "citation_check", "recommendation"],
    "additionalProperties": False,
}


async def run_evaluation_agent(content: dict, research_items: list) -> dict:
    client = get_client()
    user = (
        f"Content agent output:\n{json.dumps(content, indent=2)}\n\n"
        f"Research items:\n{json.dumps(research_items, indent=2)}"
    )
    response = await _create(
        client,
        system=EVAL_SYSTEM,
        user=user,
        schema=EVAL_SCHEMA,
        max_tokens=16000,
    )
    return extract_json_object(_first_text(response))


# -----------------------------------------------------------------------
# Shared Claude call helper
# -----------------------------------------------------------------------
async def _create(client, system: str, user: str, schema: dict, max_tokens: int, tools: Optional[list] = None):
    import asyncio

    kwargs = dict(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": user}],
    )
    if tools:
        kwargs["tools"] = tools
    return await asyncio.to_thread(client.messages.create, **kwargs)


def _first_text(response) -> str:
    for block in response.content:
        if block.type == "text":
            return block.text
    raise ValueError("Model response contained no text block")


# -----------------------------------------------------------------------
# WhatsApp Business API broadcast (Meta Cloud API)
# -----------------------------------------------------------------------
async def send_whatsapp_broadcast(message: str) -> dict:
    """Sends a text message to every number in WHATSAPP_BROADCAST_LIST via the
    Meta WhatsApp Cloud API. No-ops (and logs) if not configured, matching the
    optional-Resend pattern used for email."""
    import asyncio

    token = os.environ.get("WHATSAPP_API_TOKEN", "")
    phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    recipients = [r.strip() for r in os.environ.get("WHATSAPP_BROADCAST_LIST", "").split(",") if r.strip()]

    if not token or not phone_number_id or not recipients:
        logger.info("[WHATSAPP DISABLED] WhatsApp Business API not configured; skipping broadcast")
        return {"sent": False, "reason": "not_configured", "recipients": 0}

    def _send_one(to: str):
        url = f"https://graph.facebook.com/v20.0/{phone_number_id}/messages"
        payload = json.dumps({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": message, "preview_url": True},
        }).encode("utf-8")
        req = urllib.request.Request(
            url, data=payload, method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return {"to": to, "ok": True, "status": resp.status}
        except urllib.error.HTTPError as e:
            return {"to": to, "ok": False, "status": e.code, "error": e.read().decode("utf-8", "ignore")}
        except Exception as e:
            return {"to": to, "ok": False, "error": str(e)}

    results = await asyncio.gather(*[asyncio.to_thread(_send_one, r) for r in recipients])
    sent_count = sum(1 for r in results if r.get("ok"))
    logger.info(f"[WHATSAPP BROADCAST] sent={sent_count}/{len(recipients)}")
    return {"sent": True, "recipients": len(recipients), "succeeded": sent_count, "results": results}
