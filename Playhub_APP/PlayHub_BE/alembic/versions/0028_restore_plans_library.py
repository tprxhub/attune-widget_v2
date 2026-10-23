"""Put back Plans library content that deploys reset before the seed became create-only.

Until 2026-10-23 every deploy re-ran the seed, which rewrote catalogue plan, dose and activity
text and deleted activity 0 of each dose. This restores what the Super Admin had saved, taken
from database backups made just before each deploy:

- the dose summaries typed in the app (13 doses), and
- the full activity lists of Pinch & Grip Rookie and Starter as saved on 2026-10-21: titles,
  steps (with formatting), videos and order. Their video files are still in storage.

A row is only changed if it has not been edited since the backup used to build this list, so
newer work is never overwritten. On a database without these rows (a fresh install) it does
nothing. Downgrade leaves the content in place.

Revision ID: 0028_restore_plans_library
Revises: 0027_child_moderators
"""
from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

from app.models import Activity, ActivityKind, PlayDose, VideoSourceType

revision = "0028_restore_plans_library"
down_revision = "0027_child_moderators"
branch_labels = None
depends_on = None

RESTORE = {'doses': [{'id': 'a5fc1223-bbc1-456b-a4d4-593f0f108713',
            'label': 'Pinch & Grip Development / Rookie / Fix the Pencil Grip',
            'summary': 'GOAL: By day 7, the child will trace a dotted wavy line and a dotted zigzag on '
                       'paper, holding a short crayon with fingertips (thumb and 1–2 fingers, not a fist), '
                       'with no more than 1 reminder.',
            'summary_guard': 'By day 7, the child will trace a dotted wavy line and a dotted zigzag on '
                             'paper, holding a short crayon with fingertips (thumb and 1–2 fingers, not a '
                             'fist), with no more than 1 reminder.',
            'activities': [{'id': '6db1e07d-704f-41f6-a281-4fa6d64dfa67',
                            'guard': '2026-10-23T16:32:59.348412+00:00',
                            'sequence': 0,
                            'day': 1,
                            'kind': 'ACTIVITY',
                            'title': 'Peg Push Party',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': "<ul><li><p><strong>Toy:</strong> Pegs n' "
                                                 'Frame</p></li><li><p><strong>Goal:</strong> Improve '
                                                 'vertical grasp and release</p></li><li><p><strong>Activity '
                                                 'Level:</strong> '
                                                 'Forerunner</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Provide '
                                                 'a few pegs and the frame (10-15 pegs at a '
                                                 'time).</p></li><li><p>Ask the child to push each peg into '
                                                 'a hole with one '
                                                 'hand.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Place only a few pegs at a time to support '
                                                 'motivation. You could also use a timer races to add '
                                                 'excitement!</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'Pegs and Frame</p></li><li><p><strong>Setup '
                                                 'Needed:</strong> '
                                                 'None</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐ '
                                                 '(2),</p></li><li><p>🧍 Bilateral Coordination: ⭐⭐ '
                                                 '(2)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐☆ (3/5)</p></li><li><p><strong>Parent Win:</strong> "He '
                                                 'used just one hand without '
                                                 'switching!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/3724004a34044115812ea6e22f911729.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '04687fd0-a72b-47a6-8491-6d94a2f74ed6',
                            'guard': '2026-10-23T16:32:59.348412+00:00',
                            'sequence': 1,
                            'day': 2,
                            'kind': 'ACTIVITY',
                            'title': 'PathPad Fun',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> Pathpad + '
                                                 'Pen</p></li><li><p><strong>Goal:</strong> Activate thumb '
                                                 'and finger pincer grasp</p></li><li><p><strong>Activity '
                                                 'Level:</strong> '
                                                 'Forerunner</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Lay '
                                                 'the Pathpad flat.</p></li><li><p>Have the child push down '
                                                 'using the stylus with thumb and index '
                                                 'finger.</p></li><li><p>Move from point to point using '
                                                 'gentle pinches.</p></li><li><p>Encourage them to use the '
                                                 'other hand to stabilize the '
                                                 'PathPad.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Use color codes to add step-by-step '
                                                 'fun.</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'Pathpad, Pen</p></li><li><p><strong>Setup Needed:</strong> '
                                                 'None</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐⭐⭐ '
                                                 '(4),</p></li><li><p>🧍 Bilateral Coordination: ⭐⭐ '
                                                 '(2)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐⭐☆ (4/5)</p></li><li><p><strong>Parent Win:</strong> '
                                                 '"My child used their thumb and fingers with better '
                                                 'coordination."</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/5d928302d83e44698a4bf0a176a97d42.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '7879f16f-a84c-4e1e-8158-f273fc8282ba',
                            'guard': '2026-10-23T16:32:59.348412+00:00',
                            'sequence': 2,
                            'day': 3,
                            'kind': 'ACTIVITY',
                            'title': 'Stack Click Blocks',
                            'instructions': ['Toy: Click Blocks',
                                             'Goal: Strengthen finger grip for click-and-release',
                                             'Activity Level: Forerunner',
                                             'Steps:',
                                             'Place 5 click blocks on the table.',
                                             'Encourage child to connect and disconnect them slowly.',
                                             'Bonus Tip: Emphasize snapping sounds for auditory feedback.',
                                             'Tools Needed: Click Blocks',
                                             'Setup Needed: None',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐ (2),',
                                             '🧍 Bilateral Coordination: ⭐⭐ (2)',
                                             'Interest: ⭐⭐⭐⭐☆ (4/5)',
                                             'Parent Win: "He focused on finger work for 5 straight '
                                             'minutes!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> Click '
                                                 'Blocks</p></li><li><p><strong>Goal:</strong> Strengthen '
                                                 'finger grip for '
                                                 'click-and-release</p></li><li><p><strong>Activity '
                                                 'Level:</strong> '
                                                 'Forerunner</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Place '
                                                 '5 click blocks on the table.</p></li><li><p>Encourage '
                                                 'child to connect and disconnect them '
                                                 'slowly.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Emphasize snapping sounds for auditory '
                                                 'feedback.</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'Click Blocks</p></li><li><p><strong>Setup Needed:</strong> '
                                                 'None</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐ '
                                                 '(2),</p></li><li><p>🧍 Bilateral Coordination: ⭐⭐ '
                                                 '(2)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐⭐☆ (4/5)</p></li><li><p><strong>Parent Win:</strong> '
                                                 '"He focused on finger work for 5 straight '
                                                 'minutes!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/e80590e37c764d099e9856bbe027560c.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '4f0043fa-066c-419c-adba-bdb974d9ff20',
                            'guard': '2026-10-23T16:32:59.348412+00:00',
                            'sequence': 3,
                            'day': 4,
                            'kind': 'ACTIVITY',
                            'title': 'Twist & Turn',
                            'instructions': ['Toy: Nuts & Bolts',
                                             'Goal: Support rotational wrist and finger motion',
                                             'Steps:',
                                             'Give 2-4 nuts and bolts.',
                                             'Let the child twist bolts onto the nuts using fingers.',
                                             'Bonus Tip: Name colors while twisting!',
                                             'Tools Needed: Nuts and Bolts',
                                             'Setup Needed: None',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐ (2),',
                                             '🧍 Bilateral Coordination: ⭐⭐⭐ (3)',
                                             'Interest: ⭐⭐⭐☆ (3/5)',
                                             'Parent Win: "He twisted the nut with just his fingers—no '
                                             'palm!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> Nuts &amp; '
                                                 'Bolts</p></li><li><p><strong>Goal:</strong> Support '
                                                 'rotational wrist and finger '
                                                 'motion</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Give '
                                                 '2-4 nuts and bolts.</p></li><li><p>Let the child twist '
                                                 'bolts onto the nuts using '
                                                 'fingers.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Name colors while '
                                                 'twisting!</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'Nuts and Bolts</p></li><li><p><strong>Setup '
                                                 'Needed:</strong> '
                                                 'None</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐ '
                                                 '(2),</p></li><li><p>🧍 Bilateral Coordination: ⭐⭐⭐ '
                                                 '(3)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐☆ (3/5)</p></li><li><p><strong>Parent Win:</strong> "He '
                                                 'twisted the nut with just his fingers—no '
                                                 'palm!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/cc20492acc8c443289b6d188151ad6a6.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': 'cdcde172-39ff-4256-8c2e-dbc6e343bec3',
                            'guard': '2026-10-23T16:32:59.348412+00:00',
                            'sequence': 4,
                            'day': 5,
                            'kind': 'ACTIVITY',
                            'title': 'Trace the Track',
                            'instructions': ['Toy: White Board + Marker',
                                             'Goal: Strengthen finger trails for pre-writing control',
                                             'Activity Level: Forerunner',
                                             'Steps:',
                                             'Draw dotted lines or mazes on the white board.',
                                             'Ask the child to trace slowly using the marker with thumb and '
                                             'fingers.',
                                             'Bonus Tip: Let them erase paths with a tissue monster after '
                                             'each success.',
                                             'Tools Needed: White Board, Marker',
                                             'Setup Needed: Draw a visual path',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐⭐⭐ (4),',
                                             '👁️ Visual Perception: ⭐⭐ (2)',
                                             'Interest: ⭐⭐⭐⭐☆ (4/5)',
                                             'Parent Win: "He stayed inside the lines—no scribbles!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> White Board + '
                                                 'Marker</p></li><li><p><strong>Goal:</strong> Strengthen '
                                                 'finger trails for pre-writing '
                                                 'control</p></li><li><p><strong>Activity Level:</strong> '
                                                 'Forerunner</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Draw '
                                                 'dotted lines or mazes on the white '
                                                 'board.</p></li><li><p>Ask the child to trace slowly using '
                                                 'the marker with thumb and '
                                                 'fingers.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Let them erase paths with a tissue monster '
                                                 'after each success.</p></li><li><p><strong>Tools '
                                                 'Needed:</strong> White Board, '
                                                 'Marker</p></li></ul><p></p><ul><li><p><strong>Setup '
                                                 'Needed:</strong> Draw a visual '
                                                 'path</p></li><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐⭐⭐ '
                                                 '(4),</p></li><li><p>👁️ Visual Perception: ⭐⭐ '
                                                 '(2)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐⭐☆ (4/5)</p></li><li><p><strong>Parent Win:</strong> '
                                                 '"He stayed inside the lines—no '
                                                 'scribbles!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/c5e608c19c97467c88584f2092d65f40.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '234c32ec-c48e-4d7b-8d14-db1b1e1d1b7d',
                            'guard': '2026-10-23T16:32:59.348412+00:00',
                            'sequence': 5,
                            'day': 6,
                            'kind': 'REDO',
                            'title': 'Crayon Track',
                            'instructions': ['Draw a dotted wavy line and dotted zigzag across paper.',
                                             'Hand over a short crayon (3–4 cm) and ask the child to trace '
                                             'both while you watch their grip.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': True}]},
           {'id': 'd450ddda-dc0d-4de7-bd37-4c7fd9dc4711',
            'label': 'Pinch & Grip Development / Starter / Fix the Pencil Grip',
            'summary': 'GOAL: By day 7, the child will trace 3 dotted uppercase letters on paper with a '
                       'regular pencil, keeping a 3-finger grasp on all 3 letters, with no more than 1 '
                       'reminder.',
            'summary_guard': 'By day 7, the child will trace 3 dotted uppercase letters on paper with a '
                             'regular pencil, keeping a 3-finger grasp on all 3 letters, with no more than 1 '
                             'reminder.',
            'activities': [{'id': 'a327f57e-8efa-44cb-adfa-1c40cdf0a807',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 0,
                            'day': 1,
                            'kind': 'ACTIVITY',
                            'title': 'Tangram Match',
                            'instructions': ['Toy: Tangram',
                                             'Goal: Enhance visual-motor integration and finger placement',
                                             'Activity Level: Starter',
                                             'Steps:',
                                             'Provide a simple tangram shape pattern.',
                                             'Ask child to replicate the shape by fitting pieces together.',
                                             'Bonus Tip: Use a story prompt (e.g., "Build the fox’s '
                                             'square!").',
                                             'Tools Needed: Tangram Set',
                                             'Setup Needed: Print or show reference picture',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐⭐ (3),',
                                             '👁️ Visual Perception: ⭐⭐⭐⭐ (4)',
                                             'Interest: ⭐⭐⭐⭐☆ (4/5)',
                                             'Parent Win: "He matched all the shapes to make the picture!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> '
                                                 'Tangram</p></li><li><p><strong>Goal:</strong> Enhance '
                                                 'visual-motor integration and finger '
                                                 'placement</p></li><li><p><strong>Activity Level:</strong> '
                                                 'Starter</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Provide '
                                                 'a simple tangram shape pattern.</p></li><li><p>Ask child '
                                                 'to replicate the shape by fitting pieces '
                                                 'together.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Use a story prompt (e.g., "Build the fox’s '
                                                 'square!").</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'Tangram Set</p></li><li><p><strong>Setup Needed:</strong> '
                                                 'Print or show reference '
                                                 'picture</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐⭐ '
                                                 '(3),</p></li><li><p>👁️ Visual Perception: ⭐⭐⭐⭐ '
                                                 '(4)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐⭐☆ (4/5)</p></li><li><p><strong>Parent Win:</strong> '
                                                 '"He matched all the shapes to make the '
                                                 'picture!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/b22a31d2fd6448fba6c08941256c1db7.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '08a118eb-7f76-42ec-bca9-45d0723f76d1',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 1,
                            'day': 2,
                            'kind': 'ACTIVITY',
                            'title': 'Peg Patterns',
                            'instructions': ["Toy: Pegs n' Frame",
                                             'Goal: Strengthen sequencing and spatial memory',
                                             'Activity Level: Starter',
                                             'Steps:',
                                             'Create a 3-peg color pattern.',
                                             'Ask child to copy the same pattern below.',
                                             'Bonus Tip: Turn into a memory game by covering the top row!',
                                             'Tools Needed: Pegs, Frame',
                                             'Setup Needed: Pattern example',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐ (2),',
                                             '👁️ Visual Perception: ⭐⭐⭐ (3)',
                                             'Interest: ⭐⭐⭐☆ (3/5)',
                                             'Parent Win: "He got the pattern right after just one try!"'],
                            'instructions_html': "<ul><li><p><strong>Toy:</strong> Pegs n' "
                                                 'Frame</p></li><li><p><strong>Goal:</strong> Strengthen '
                                                 'sequencing and spatial '
                                                 'memory</p></li><li><p><strong>Activity Level:</strong> '
                                                 'Starter</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Create '
                                                 'a 3-peg color pattern.</p></li><li><p>Ask child to copy '
                                                 'the same pattern '
                                                 'below.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Turn into a memory game by covering the top '
                                                 'row!</p></li><li><p><strong>Tools Needed:</strong> Pegs, '
                                                 'Frame</p></li><li><p><strong>Setup Needed:</strong> '
                                                 'Pattern '
                                                 'example</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐ '
                                                 '(2),</p></li><li><p>👁️ Visual Perception: ⭐⭐⭐ '
                                                 '(3)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐☆ (3/5)</p></li><li><p><strong>Parent Win:</strong> "He '
                                                 'got the pattern right after just one '
                                                 'try!"</p></li></ul><p><br></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/328a6c1a96284c52889148a23feae69f.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '306f3fae-2a50-4bd9-bdfc-8f5dd85406e4',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 2,
                            'day': 3,
                            'kind': 'ACTIVITY',
                            'title': 'Build and Bump',
                            'instructions': ['Toy: Click Blocks',
                                             'Goal: Encourage pinch accuracy and tension control',
                                             'Activity Level: Starter',
                                             'Steps:',
                                             'Build a tower with 3 specific colours.',
                                             'Ask the child to copy the pattern (including colours).',
                                             'Bonus Tip: Pretend that they are building their own '
                                             'skyscraper."',
                                             'Tools Needed: Click Blocks',
                                             'Setup Needed: None',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐ (2),',
                                             '🧍 Bilateral Coordination: ⭐⭐⭐ (3)',
                                             'Interest: ⭐⭐⭐⭐☆ (4/5)',
                                             'Parent Win: "He removed blocks carefully using finger '
                                             'strength!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> Click '
                                                 'Blocks</p></li><li><p><strong>Goal:</strong> Encourage '
                                                 'pinch accuracy and tension '
                                                 'control</p></li><li><p><strong>Activity Level:</strong> '
                                                 'Starter</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Build '
                                                 'a tower with 3 specific colours.</p></li><li><p>Ask the '
                                                 'child to copy the pattern (including '
                                                 'colours).</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Pretend that they are building their own '
                                                 'skyscraper."</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'Click Blocks</p></li><li><p><strong>Setup Needed:</strong> '
                                                 'None</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐ '
                                                 '(2),</p></li><li><p>🧍 Bilateral Coordination: ⭐⭐⭐ '
                                                 '(3)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐⭐☆ (4/5)</p></li><li><p><strong>Parent Win:</strong> '
                                                 '"He removed blocks carefully using finger '
                                                 'strength!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/1d7ffef7bac6411caad95c0ba80e975f.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '804b62a5-dcb3-494f-8996-6f04ecc7c730',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 3,
                            'day': 4,
                            'kind': 'ACTIVITY',
                            'title': 'Bolt Match Race',
                            'instructions': ['Toy: Nuts & Bolts',
                                             'Goal: Boost fine motor matching and visual scanning',
                                             'Activity Level: Starter',
                                             'Steps:',
                                             'Lay out bolts of different sizes.',
                                             'Ask child to find matching nuts quickly.',
                                             'Bonus Tip: Use a timer for race mode.',
                                             'Tools Needed: Mixed Nuts and Bolts',
                                             'Setup Needed: Scatter setup',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐ (2),',
                                             '👁️ Visual Perception: ⭐⭐ (2)',
                                             'Interest: ⭐⭐⭐☆ (3/5)',
                                             'Parent Win: "He matched them without asking for help!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> Nuts &amp; '
                                                 'Bolts</p></li><li><p><strong>Goal:</strong> Boost fine '
                                                 'motor matching and visual '
                                                 'scanning</p></li><li><p><strong>Activity Level:</strong> '
                                                 'Starter</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Lay '
                                                 'out bolts of different sizes.</p></li><li><p>Ask child to '
                                                 'find matching nuts '
                                                 'quickly.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Use a timer for race '
                                                 'mode.</p></li><li><p><strong>Tools Needed:</strong> Mixed '
                                                 'Nuts and Bolts</p></li><li><p><strong>Setup '
                                                 'Needed:</strong> Scatter '
                                                 'setup</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐ '
                                                 '(2),</p></li><li><p>👁️ Visual Perception: ⭐⭐ '
                                                 '(2)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐☆ (3/5)</p></li><li><p><strong>Parent Win:</strong> "He '
                                                 'matched them without asking for '
                                                 'help!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/2466a488d9f24a99946849a445c04f17.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '3f92150b-0819-4e06-8c35-06b2ed50d752',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 4,
                            'day': 5,
                            'kind': 'ACTIVITY',
                            'title': 'Letter Trail Maker',
                            'instructions': ['Toy: White Board + Marker',
                                             'Goal: Prepare for handwriting through controlled tracing',
                                             'Activity Level: Starter',
                                             'Steps:',
                                             'Write 3–4 large uppercase letters with dots.',
                                             'Ask the child to connect the dots slowly while holding the '
                                             'marker using only 3 fingers.',
                                             'Bonus Tip: Say each letter sound while tracing.',
                                             'Tools Needed: White Board, Marker',
                                             'Setup Needed: Pre-dotted letters',
                                             'Skill Ratings:',
                                             '✏️ Handwriting: ⭐⭐⭐⭐ (4),',
                                             '👁️ Visual Perception: ⭐⭐⭐ (3)',
                                             'Interest: ⭐⭐⭐⭐☆ (4/5)',
                                             'Parent Win: "He traced all the letters without skipping!"'],
                            'instructions_html': '<ul><li><p><strong>Toy:</strong> White Board + '
                                                 'Marker</p></li><li><p><strong>Goal:</strong> Prepare for '
                                                 'handwriting through controlled '
                                                 'tracing</p></li><li><p><strong>Activity Level:</strong> '
                                                 'Starter</p></li></ul><p></p><ul><li><p><strong>Steps:</strong></p></li></ul><ol><li><p>Write '
                                                 '3–4 large uppercase letters with dots.</p></li><li><p>Ask '
                                                 'the child to connect the dots slowly while holding the '
                                                 'marker using only 3 '
                                                 'fingers.</p></li></ol><p></p><ul><li><p><strong>Bonus '
                                                 'Tip:</strong> Say each letter sound while '
                                                 'tracing.</p></li><li><p><strong>Tools Needed:</strong> '
                                                 'White Board, Marker</p></li><li><p><strong>Setup '
                                                 'Needed:</strong> Pre-dotted '
                                                 'letters</p></li></ul><p></p><ul><li><p><strong>Skill '
                                                 'Ratings:</strong></p></li><li><p>✏️ Handwriting: ⭐⭐⭐⭐ '
                                                 '(4),</p></li><li><p>👁️ Visual Perception: ⭐⭐⭐ '
                                                 '(3)</p></li></ul><p></p><ul><li><p><strong>Interest:</strong> '
                                                 '⭐⭐⭐⭐☆ (4/5)</p></li><li><p><strong>Parent Win:</strong> '
                                                 '"He traced all the letters without '
                                                 'skipping!"</p></li></ul><p></p>',
                            'video_source_type': 'UPLOAD',
                            'video_url': 'https://playhub-media-121014832711.s3.eu-north-1.amazonaws.com/media/videos/3a6a95b3b0da420c89e5db3510b05e7b.mp4',
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': 'bca769de-3b89-40ca-b9ed-0f55c39c8412',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 5,
                            'day': 6,
                            'kind': 'REDO',
                            'title': 'Paper Letter Trail',
                            'instructions': ['Write 3 dotted uppercase letters such as L, T and H.',
                                             'Ask the child to trace each letter and watch for a '
                                             'three-finger grasp throughout.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': True}]},
           {'id': 'd5ce665c-d5c1-458b-8abd-b7a643649b4f',
            'label': 'Pinch & Grip Development / Pro / Fix the Pencil Grip',
            'summary': 'By Day 7, your child will trace three letters within guide lines, then draw freely '
                       'for two minutes. They’ll use a three- or four-finger grip, control the pencil with '
                       'their fingers and adjust their grip without help. Tracing goal: Touch the guide '
                       'lines no more than twice per letter.',
            'summary_guard': 'By day 7, the child will trace 3 letters inside a paper road and then draw '
                             'freely for 2 minutes with a pencil, keeping a functional 3- or 4-finger grasp, '
                             'moving from the fingers, touching the edges no more than twice per letter and '
                             'correcting their own grip when it slips, independently.'},
           {'id': 'cbcbaaee-710e-4d72-8471-f261906b3d5c',
            'label': 'Bilateral Coordination & Midline Crossing / Rookie / Learn to Button a Shirt',
            'summary': 'GOAL: By day 7, the child will hold a small jar steady with one hand and twist the '
                       'lid off and on with the other, 3 times with one hand swap, with no more than 1 '
                       'reminder.',
            'summary_guard': 'By day 7, the child will hold a small jar steady with one hand and twist the '
                             'lid off and on with the other, 3 times with one hand swap, with no more than 1 '
                             'reminder.'},
           {'id': '2e27d2fe-ef54-432d-b656-e98210e1f031',
            'label': 'Bilateral Coordination & Midline Crossing / Starter / Learn to Button a Shirt',
            'summary': 'By Day 7, your child will undo two large buttons on a shirt laid flat. They’ll '
                       'steady the fabric with one hand and push each button through with the other, with at '
                       'most one reminder.',
            'summary_guard': 'By day 7, the child will undo 2 large buttons on a shirt laid flat, holding '
                             'the fabric steady with one hand and pushing each button through with the '
                             'other, with no more than 1 reminder.'},
           {'id': 'd7ba430b-af7b-4fd2-a902-404cf7065b41',
            'label': 'Bilateral Coordination & Midline Crossing / Pro / Learn to Button a Shirt',
            'summary': 'By Day 7, your child will fasten three large buttons on a shirt laid flat. They’ll '
                       'hold each buttonhole with one hand and push the button through with the other, '
                       'without help.',
            'summary_guard': 'By day 7, the child will do up 3 large buttons on a shirt laid flat, one hand '
                             'holding the buttonhole and the other pushing the button through, '
                             'independently.'},
           {'id': '51bc3cf2-1c95-410f-927e-e3e6948079fd',
            'label': 'Visual-Motor Integration & Eye-Hand Coordination / Rookie / Make Reading Easy',
            'summary': 'By Day 7, your child will join seven numbered dots in order and copy a plus sign '
                       'beside an example. They’ll need at most one reminder.',
            'summary_guard': 'By day 7, the child will join 7 numbered dots in order on paper and copy a + '
                             'next to a model, with no more than 1 reminder.'},
           {'id': 'b5cfcf73-a6c7-4592-8d91-fcc801d619f4',
            'label': 'Visual-Motor Integration & Eye-Hand Coordination / Starter / Make Reading Easy',
            'summary': 'By Day 7, your child will copy two patterns: circle–square and '
                       'circle–square–triangle. They’ll work left to right, keeping the shapes in order and '
                       'the square’s corners clear, with at most one reminder.',
            'summary_guard': 'By day 7, the child will copy two shape patterns (circle–square, then '
                             'circle–square–triangle) on paper in the right order, left to right, with a '
                             'square that has clear corners, with no more than 1 reminder.'},
           {'id': 'e3385421-d818-4f57-bdba-1f5cb1c8e04b',
            'label': 'Visual-Motor Integration & Eye-Hand Coordination / Pro / Make Reading Easy',
            'summary': 'By Day 7, your child will copy a four-shape design from a card an arm’s length away. '
                       'They’ll draw the triangle, X, square and circle clearly and in the right positions, '
                       'without help.',
            'summary_guard': 'By day 7, the child will copy a 4-shape design (triangle, X, square, circle) '
                             "from a card placed an arm's length away, with every shape recognisable and in "
                             'the right position, independently.'},
           {'id': '77b9c05f-e161-4cee-9cbc-60b80a6401c3',
            'label': 'Pre-Handwriting Patterns & Line Mastery / Rookie / Color Inside the Lines',
            'summary': 'By Day 7, your child will colour three wide rainbow bands. They’ll go outside each '
                       'band no more than twice, with at most one reminder.',
            'summary_guard': 'By day 7, the child will colour 3 wide rainbow bands on paper, going outside '
                             'each band no more than twice, with no more than 1 reminder.'},
           {'id': 'e0a3a147-8233-4872-b9a1-86e3509ad0f6',
            'label': 'Visual Scanning, Tracking & Matching / Rookie / Copy Correctly',
            'summary': 'By Day 7, your child will find and circle all five matching shapes among twenty. '
                       'They’ll circle only the correct shapes, with at most one reminder.',
            'summary_guard': 'By day 7, the child will find and circle all 5 target shapes among 20 on '
                             'paper, with no wrong circles, with no more than 1 reminder.'},
           {'id': '879d4868-026e-41f4-8ed7-def84576d63e',
            'label': 'Visual Scanning, Tracking & Matching / Starter / Copy Correctly',
            'summary': 'By Day 7, your child will look at three shapes for five seconds, then draw them from '
                       'memory. They’ll get the order right in two out of three tries, with at most one '
                       'reminder.',
            'summary_guard': 'By day 7, the child will draw a row of 3 shapes from memory after a 5-second '
                             'look, in the right order, in 2 of 3 tries, with no more than 1 reminder.'},
           {'id': 'd6e87f6e-f593-474c-b789-3db5455d2450',
            'label': 'Visual Scanning, Tracking & Matching / Pro / Copy Correctly',
            'summary': 'By Day 7, your child will copy their first name or a four-letter word from a card '
                       'across the table. They’ll keep every letter in the right order without missing any, '
                       'without help.',
            'summary_guard': 'By day 7, the child will copy their first name or a 4-letter word from a card '
                             'placed across the table, with no missed or swapped letters, independently.'}]}


def _when(value: str) -> datetime:
    return datetime.fromisoformat(value)


def upgrade() -> None:
    bind = op.get_bind()
    doses = PlayDose.__table__
    activities = Activity.__table__
    for dose in RESTORE["doses"]:
        if "summary" in dose:
            bind.execute(
                doses.update()
                .where(doses.c.id == dose["id"], doses.c.summary == dose["summary_guard"])
                .values(summary=dose["summary"], updated_at=sa.func.now())
            )
        rows = dose.get("activities")
        if not rows:
            continue
        current = {
            row.id: row.updated_at
            for row in bind.execute(
                sa.select(activities.c.id, activities.c.updated_at).where(activities.c.play_dose_id == dose["id"])
            )
        }
        # All or nothing per dose: skip it if its activities changed since the backup.
        if set(current) != {row["id"] for row in rows} or any(
            current[row["id"]] is None or _as_utc(current[row["id"]]) > _when(row["guard"]) for row in rows
        ):
            continue
        # Move sequences out of the way first; (play_dose_id, sequence) is unique.
        for offset, row in enumerate(rows):
            bind.execute(activities.update().where(activities.c.id == row["id"]).values(sequence=1000 + offset))
        for row in rows:
            bind.execute(
                activities.update()
                .where(activities.c.id == row["id"])
                .values(
                    sequence=row["sequence"],
                    day=row["day"],
                    kind=ActivityKind[row["kind"]],
                    title=row["title"],
                    instructions=row["instructions"],
                    instructions_html=row["instructions_html"],
                    video_source_type=VideoSourceType[row["video_source_type"]] if row["video_source_type"] else None,
                    video_url=row["video_url"],
                    duration_minutes=row["duration_minutes"],
                    is_loggable=row["is_loggable"],
                    is_real_life_try=row["is_real_life_try"],
                    updated_at=sa.func.now(),
                )
            )


def _as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; Postgres returns aware ones.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def downgrade() -> None:
    # Restored content stays; there is nothing safe to undo.
    pass
