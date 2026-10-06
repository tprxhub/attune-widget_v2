"""Formatted activity steps written in the admin editor, cleaned before they are stored.

Only simple document formatting survives — paragraphs, headings, bold/italic/underline, lists,
quotes and links — so stored text is always safe to show to families as HTML.
"""
from __future__ import annotations

import re

import nh3

ALLOWED_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "a"}
ALLOWED_ATTRIBUTES = {"a": {"href"}, "ol": {"start"}}
MAX_LENGTH = 20_000


def clean_rich_text(value: str | None) -> str | None:
    """Sanitised HTML, or None when nothing readable is left."""
    if value is None:
        return None
    cleaned = nh3.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer nofollow",
    ).strip()
    if not re.sub(r"<[^>]+>|&nbsp;|\s", "", cleaned):
        return None
    return cleaned
