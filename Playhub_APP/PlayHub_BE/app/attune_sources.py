"""Attune's clinical source register (Product Reasoning Blueprint, section 7).

Every resource that shapes Attune's reasoning is recorded here with its status, what it supports,
its evidence strength, what Attune must not do with it, licensing limits and clinical review. The
references panel under each answer only ever lists sources from this register whose status is
"cited in instructions", so Attune cannot claim a resource it was never given.

Changing a source, its status or its review is a new register version: bump REGISTER_VERSION.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

REGISTER_VERSION = "2026-10-15"

Status = Literal["loaded", "cited", "background", "proposed"]
STATUS_LABEL: dict[str, str] = {
    "loaded": "Loaded into the model",
    "cited": "Cited in instructions",
    "background": "Background only",
    "proposed": "Proposed for review",
}

PENDING_REVIEW = "Pending: Dr. Esther Michael, OT, before public launch"


@dataclass(frozen=True)
class Source:
    id: str
    # How the source appears in the references panel: plain text, no links (v1).
    reference: str
    citation: str
    status: Status
    supports: str
    evidence: str
    limitations: str
    licensing: str
    review: str = PENDING_REVIEW

    def as_dict(self) -> dict:
        return {**asdict(self), "status_label": STATUS_LABEL[self.status]}


SOURCES: tuple[Source, ...] = (
    Source(
        id="pyramid",
        reference="Pyramid of Learning (Williams & Shellenberger)",
        citation="Williams, M. S. & Shellenberger, S. Pyramid of Learning, from How Does Your Engine Run? "
                 "(TherapyWorks). Edition and date to be confirmed in clinical review.",
        status="cited",
        supports="Reasoning lens for how sensory and regulation demands sit beneath participation and skills.",
        evidence="Practical model",
        limitations="A reasoning lens only: never presented as a diagnostic hierarchy.",
        licensing="Referenced by name; no material reproduced.",
    ),
    Source(
        id="kuypers",
        reference="Leah Kuypers' regulation framework",
        citation="Kuypers, L. Regulation framework (2011). Referred to by author name only.",
        status="cited",
        supports="Shared vocabulary for noticing states of alertness and energy and talking about "
                 "regulation strategies.",
        evidence="Practical model",
        limitations="Refer by author name only. No licensed or trademarked terms from the programme "
                    "(including its colour-zone labels) may appear in Attune's language or interface.",
        licensing="Trademarked programme: author name only.",
    ),
    Source(
        id="asq",
        reference="Ages & Stages Questionnaires (ASQ-3 / ASQ:SE-2)",
        citation="Squires, J. & Bricker, D. Ages & Stages Questionnaires, ASQ-3 and ASQ:SE-2 (Brookes Publishing).",
        status="background",
        supports="Background for knowing when a concern warrants a professional conversation.",
        evidence="Validated screening tool",
        limitations="Protected content: never copy items, score, administer or claim to administer it. "
                    "Not listed in answers.",
        licensing="Proprietary screener: no use without verified permission.",
    ),
    Source(
        id="ot-grading",
        reference="OT activity analysis and grading (Dr. Esther Michael, OT)",
        citation="Occupational therapy activity analysis and grading, as practised and taught by "
                 "Dr. Esther Michael, OT, founder of The Toy Pharmacy.",
        status="cited",
        supports="Function A: grading an activity up or down one dimension at a time, and what to observe.",
        evidence="Established clinical framework",
        limitations="Activities are never presented as treatment for a named diagnosis.",
        licensing="The Toy Pharmacy's own clinical method.",
    ),
    Source(
        id="gas",
        reference="Goal Attainment Scaling (GAS)",
        citation="Kiresuk, T. J. & Sherman, R. E. (1968). Goal Attainment Scaling. Community Mental Health Journal.",
        status="cited",
        supports="Play Hub levels: Rookie = -1, Starter = 0 (expected), Pro = +1. Anchors progress "
                 "interpretation and level-change suggestions.",
        evidence="Research-backed",
        limitations="Describes position against a goal; never a measure of the child's worth or a prediction.",
        licensing="Published method; no restrictions on describing levels.",
    ),
    Source(
        id="nurture",
        reference="The Nurture Revolution (Greer Kirshenbaum)",
        citation="Kirshenbaum, G. The Nurture Revolution (2022).",
        status="cited",
        supports="Parent-communication style and the framing of early experience and connection.",
        evidence="Popular explanatory model",
        limitations="Informs tone and framing; not cited as clinical evidence for a specific strategy.",
        licensing="Referenced by name; no material reproduced.",
    ),
    Source(
        id="nmt",
        reference="Neurosequential Model of Therapeutics (Dr. Bruce Perry)",
        citation="Perry, B. D. Neurosequential Model of Therapeutics (NMT).",
        status="cited",
        supports="Bottom-up approach: safety and co-regulation before reasoning or skill-building.",
        evidence="Clinical practice model",
        limitations="Informs the order of support; Attune does not deliver or claim to deliver NMT.",
        licensing="Referenced by name; no material reproduced.",
    ),
    Source(
        id="polyvagal",
        reference="Polyvagal Theory (Dr. Stephen Porges)",
        citation="Porges, S. W. The Polyvagal Theory (2011).",
        status="cited",
        supports="How safety and connection help regulate the nervous system; co-regulation first.",
        evidence="Theoretical model",
        limitations="Presented as a way of understanding, not as settled fact or a treatment.",
        licensing="Referenced by name; no material reproduced.",
    ),
    Source(
        id="co-regulation",
        reference="Co-regulation and caregiver-child relationship literature",
        citation="Specific papers and books to be named before launch.",
        status="proposed",
        supports="Co-regulation and caregiver-child relationship guidance.",
        evidence="To be graded once the titles are named",
        limitations="Not cited until each title is named and reviewed.",
        licensing="To be confirmed per title.",
    ),
    Source(
        id="floortime",
        reference="Developmental and relationship-based approaches (including Floortime)",
        citation="DIR/Floortime and related approaches.",
        status="proposed",
        supports="Developmental, relationship-based play where appropriate.",
        evidence="To be graded",
        limitations="Not cited until usage rights and endorsement are verified.",
        licensing="Usage rights and endorsement to be verified.",
    ),
)

BY_ID = {source.id: source for source in SOURCES}
CITABLE = tuple(source for source in SOURCES if source.status in ("cited", "loaded"))

# When an answer names no sources, the ones that shape that kind of answer are listed instead.
DEFAULT_REFERENCES: dict[str, tuple[str, ...]] = {
    "idea": ("ot-grading", "gas", "pyramid"),
    "regulation": ("nmt", "polyvagal", "kuypers", "nurture"),
    "progress": ("gas", "ot-grading"),
    "safety": ("nmt", "polyvagal"),
    "general": ("ot-grading", "nurture"),
}


def citable_list() -> str:
    """The reference ids the model may use, one per line, for its instructions."""
    return "\n".join(f"- {source.id}: {source.reference} — {source.supports}" for source in CITABLE)


def references_for(ids: list[str], fallback: str) -> list[dict[str, str]]:
    """The panel entries for an answer: the citable ids it named, else the defaults for its kind."""
    chosen = [i for i in dict.fromkeys(ids) if i in BY_ID and BY_ID[i] in CITABLE]
    if not chosen:
        chosen = list(DEFAULT_REFERENCES.get(fallback, DEFAULT_REFERENCES["general"]))
    return [{"id": i, "title": BY_ID[i].reference} for i in chosen[:5]]


def register() -> dict:
    return {"version": REGISTER_VERSION, "sources": [source.as_dict() for source in SOURCES]}
