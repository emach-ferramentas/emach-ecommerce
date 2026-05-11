# Design System Inspiration of Ferrari

## 1. Visual Theme & Atmosphere

Ferrari's website is a digital editorial — a curated magazine where the Prancing Horse brand is presented with the gravitas of an art institution and the precision of Italian coachwork. The page opens onto an expanse of absolute black, broken only by the iconic Prancing Horse emblem floating alone in its own atmosphere. Below, the content unfolds in dramatic alternations between inky-dark cinematic sections and crisp white editorial panels. This chiaroscuro rhythm — darkness yielding to light, machinery yielding to human story — feels more like paging through a Ferrari yearbook than scrolling a commercial website. Every section is a curated vignette: a concept car dissolving from shadow, two F1 drivers posed with sculptural stillness, a lineup of production models arranged in a jewel-toned parade.

The color language is monastically restrained for a brand built on speed and emotion. Ferrari Red (`#DA291C`) appears with almost surgical sparseness — reserved for the Subscribe CTA and accent moments that need to command immediate attention. The vast majority of the interface lives in black, white, and a carefully calibrated gray scale (from `#303030` dark surfaces through `#8F8F8F` mid-tones to `#D2D2D2` light borders). Two yellows — Racing Yellow (`#FFF200`) and the deeper Modena Yellow (`#F6E500`) — exist in the token system as heritage accents for special contexts, honoring Ferrari's racing provenance. The restraint means that when red does appear, it carries the weight of the entire brand.

Typography relies on FerrariSans — a proprietary sans-serif family with medium-weight headings (500–700) and compact proportions. Display text runs at 24–26px for section titles, while the UI chrome lives at 12–16px in weights ranging from regular to bold. A secondary "Body-Font" custom typeface handles captions and utility text, rendered in uppercase with wide letter-spacing (1px) to create a label-like editorial quality. This two-font system — FerrariSans for narrative authority, Body-Font for structural annotation — gives the site a print-magazine hierarchy. No text decoration is gratuitous. Letter-spacing is tight for headlines and deliberately expanded for labels, creating a visual rhythm that alternates between urgency and composure.

**Key Characteristics:**
- Chiaroscuro layout alternating between deep black sections and clean white editorial panels
- Ferrari Red (`#DA291C`) used with extreme sparseness — accent, not atmosphere
- Prancing Horse emblem as isolated hero element on a void-black field
- FerrariSans proprietary typeface with compact proportions and medium weights
- Photo-journalism imagery: concept renders, driver portraits, lineup parades — each section is a story
- Uppercase Body-Font labels with wide letter-spacing (1px) for editorial annotation
- Nearly zero border-radius (2px default) reflecting precision engineering aesthetics
- Dual-framework architecture (PrimeReact + Element Plus) powering 32+ interactive components
- Carousel-driven hero with editorial slides and arrow/dot navigation

## 2. Color Palette & Roles

### Primary
- **Ferrari Red** (`#DA291C`): The iconic Rosso Corsa — primary accent and CTA color. Used for the Subscribe button, key action triggers, and brand moments where maximum visual authority is needed. The single most important color in the system (--f-color-accent-100)
- **Pure White** (`#FFFFFF`): Primary surface for editorial content panels, navigation text on dark backgrounds, and button fills. The canvas that provides breathing room between dark cinematic sections (--f-color-ui-0)

### Secondary & Accent
- **Dark Red** (`#B01E0A`): Deeper variant of Ferrari Red for hover/pressed states and high-contrast contexts — adds dimensionality to the brand color without introducing a new hue (--f-color-accent-90)
- **Deep Red** (`#9D2211`): The most saturated dark red — used for active states and extra emphasis where even Dark Red needs more weight (--f-color-accent-80)
- **Racing Yellow** (`#FFF200`): Heritage accent from Ferrari's racing livery — reserved for special highlights and motorsport-related contexts (--f-color-yellow-hypersail)
- **Modena Yellow** (`#F6E500`): Slightly warmer and more golden than Racing Yellow — used for secondary heritage accents and category markers (--f-color-yellow)

### Surface & Background
- **Absolute Black** (`#000000`): Hero sections, cinematic backgrounds, and the dominant dark surface — the void that makes imagery and the Prancing Horse emblem float
- **Dark Surface** (`#303030`): Secondary dark surface for footer regions, newsletter sections, and layered dark panels — slightly lifted from pure black for depth differentiation (--f-color-ui-90)
- **Light Gray Surface** (`#D2D2D2`): Subtle alternate surface for dividers and border treatments on white panels (--f-color-ui-20)
- **Overlay Dark** (`hsla(0, 0%, 7%, 0.8)`): Semi-transparent near-black for modal overlays and image caption backgrounds (--f-color-overlay-darker)

### Neutrals & Text
- **Near Black** (`#181818`): Primary body text color on light surfaces — slightly softened from absolute black for better readability (link default color)
- **Dark Gray** (`#666666`): Secondary text and subdued UI labels — used where text needs to recede from the primary hierarchy (--f-color-black-60)
- **Mid Gray** (`#8F8F8F`): Tertiary text for metadata, timestamps, and supportive content (--f-color-black-50)
- **Silver Gray** (`#969696`): Placeholder text and disabled state indicators (--f-color-black-55)

### Semantic & Accent
- **Warning Red** (`#F13A2C`): Accessible warning state — brighter and more orange-shifted than Ferrari Red to differentiate semantic alerts from brand expression (--f-color-accessible-warning)
- **Success Green** (`#16A34A`): Confirmation and positive status indicators. EMACH uses a brighter, more modern green than the original Ferrari token (`#03904A`) for better legibility on both light and dark surfaces (--emach-success)
- **Info Blue** (`#4C98B9`): Informational callouts, tooltips, and neutral status messaging (--f-color-accessible-info)
- **Link Hover Blue** (`#3860BE`): Interactive hover state for text links — a dignified navy-blue that signals interactivity without competing with Ferrari Red

### Gradient System
- No explicit gradients in the token system
- Depth is achieved through photography and the binary contrast between black and white surfaces
- The overlay darker color (`hsla(0, 0%, 7%, 0.8)`) creates depth through transparency layering over imagery
- Occasional photographic gradients (light falloff in studio shots) provide atmospheric depth within image content

## 3. Typography Rules

### Font Family
- **Barlow** (`--font-sans`, wired via `next/font` in `apps/web/src/app/layout.tsx`): Primary typeface for headings, navigation, buttons, and editorial content. Loaded with weights 400–700; default heading voice runs at 500. Barlow was chosen as the open-source counterpart to FerrariSans — compact x-height, slight condensation, precise counters. Fallbacks: Arial, Helvetica, sans-serif
- **Barlow Condensed** (`--font-display`, wired via `next/font`): Secondary typeface for captions, labels, category tags and all `SectionLabel` usage. Always rendered in uppercase with wide letter-spacing (0.12–0.14em). Also powers oversized display headings on the hero (`clamp(44px, 6vw, 84px)`), where its narrower proportions keep long product copy in-bounds
- **System fallback**: Arial / Helvetica — used only as the ultimate fallback when the custom fonts fail to load

> **Note**: The original Ferrari design references `FerrariSans` + `Body-Font`. EMACH substitutes Barlow / Barlow Condensed one-to-one because FerrariSans is proprietary and unlicensable. All weight/tracking rules below still apply.

### Hierarchy (EMACH — actual implementation)

The EMACH catalog needs a much wider display range than the original Ferrari spec because it markets oversized editorial hero copy. The table below reflects what is implemented in `apps/web`; any new screen **must** pick a size from this scale.

| Role | Size | Weight | Font | Notes / Where |
|------|------|--------|------|---------------|
| Hero Display | `clamp(44px, 6vw, 84px)` | 500 | Barlow Condensed | Home hero `<h1>` |
| Hero Headline (secondary) | `clamp(48px, 7vw, 96px)` | 500 | Barlow Condensed | 404 page and large error screens |
| Section Title — XL | 48px | 500 | Barlow Condensed | Editorial banners (home), cart empty state |
| Section Title — L | 44px | 500 | Barlow Condensed | Home sections ("Explorar por categoria", "Promoções"), catalog hero `clamp(36px, 5vw, 60px)` |
| Page Title | 40px | 500 | Barlow Condensed | Cart page `<h1>` |
| Product Title | 36px | 500 | Barlow Condensed | Product detail, empty states |
| Subsection Title | 32px | 500 | Barlow Condensed | Stat numbers in editorial banner |
| Related / Block Title | 28px | 500 | Barlow Condensed | "Você também pode gostar" |
| Modal / Sheet Heading | 24px | 700 | Barlow Condensed | Cart Sheet title, empty states |
| Card Price | 20px | 700 | Barlow | Product detail primary price |
| UI Heading | 18px | 500 | Barlow | Product list title in catalog list view |
| Subheading | 17px | 400 | Barlow | Hero subtitle |
| Body Large | 16px | 400–600 | Barlow | Product card title, editorial body |
| Body | 15px | 400 | Barlow | Product short description |
| Body Small | 14px | 400–600 | Barlow | Cart item name, form labels (`emach-field`) |
| Nav Link | 12–13px | 600 | Barlow | Primary nav + footer links; letter-spacing `0.04em` |
| Caption | 12–13px | 400 | Barlow | Metadata, SKU hints |
| Label Upper | 12px | 600 | Barlow Condensed | `SectionLabel`, category tags — uppercase, tracking `0.14em` |
| Micro Label | 11px | 600 | Barlow Condensed | Smallest editorial annotation, trust strips — uppercase, tracking `0.12–0.20em` |
| Mini | 10–11px | 700 | Barlow | Cart badge count, EmachBadge |

### Principles
- **Proprietary identity**: FerrariSans is exclusive to Ferrari — it cannot be substituted without losing brand recognition. The font's compact proportions and medium weight default (500) convey engineering precision
- **Two-register system**: FerrariSans handles narrative voice (headings, content, buttons) while Body-Font handles structural annotation (labels, tags, micro-captions) — this mirrors print magazine conventions of editorial text vs. technical labels
- **Uppercase as emphasis tool**: Body-Font captions use `text-transform: uppercase` with expanded letter-spacing (1px) to create a visually distinct label layer that reads as "informational overlay" rather than primary content
- **Compact line-heights**: Headlines use tight line-heights (1.00–1.30) creating dense, impactful text blocks, while body text opens to 1.50 for comfortable reading — the contrast between compressed headers and relaxed body text creates visual tension
- **Weight range 400–700**: Four weights active in the system (400, 500, 600, 700) — significantly more range than Tesla but still controlled. 500 is the default "voice," 700 is for emphasis, 400 for body, 600 for navigation

## 4. Component Stylings

### Buttons — EMACH `EmachButton`
Canonical implementation: `apps/web/src/components/emach-button.tsx`. All EMACH pages use `EmachButton` instead of shadcn `<Button>`. The component is built on `cva` with `variant` × `size` × `full`.

**Shared base:**
- Radius: `2px` (razor precision)
- Font: Barlow Sans, weight 600, tracking `0.04em`
- Transition: `180ms` ease on all properties
- Disabled: `pointer-events-none opacity-60`

**Sizes:**
| Size | Height | Padding X | Font size |
|------|--------|-----------|-----------|
| `sm` | 36px | 16px | 12px |
| `md` (default) | 44px | 22px | 13px |
| `lg` | 52px | 30px | 14px |

**Variants:**

| Variant | Default | Hover | Primary use |
|---------|---------|-------|-------------|
| `primary` | `bg-emach-red`, text white | `bg-emach-red-hover` | High-priority CTAs: "Adicionar ao carrinho", "Finalizar compra", "Ver catálogo" |
| `outline` | `border-near-black`, text near-black, transparent bg | `bg-near-black`, text white (inverts) | Secondary actions on light surfaces: "Página inicial", "Continuar comprando" |
| `outline-light` | `border-white/70`, text white, transparent bg | `bg-white`, text near-black (inverts) | Actions overlaid on dark cinematic sections (hero, editorial banners) |
| `ghost` | Transparent, text near-black | `bg-gray-10` | Tertiary link-like buttons, cart sheet secondary action |
| `dark` | `bg-near-black`, text white | `bg-black` | Attached buttons (coupon "Aplicar") that need a darker fill |

**Usage rule:** One `primary` (red) button per viewport fold. Outline/ghost variants carry secondary actions so Ferrari Red keeps its authority.

**Text link (inline)**:
- Text `text-emach-red` for "Esqueci a senha" / destructive-leaning links in forms
- Text `text-gray-60 underline` for "Remover" inside cart rows
- Standard link color on light surfaces: `text-near-black`; on dark: `text-white`
- Hover: Link Hover Blue (`--link-hover`) reserved for body-copy anchors (not in use yet; slot reserved)

### Cards & Containers

**Editorial Card** (Content sections):
- Background: white
- Border: none
- Shadow: none
- Layout: image above, heading + caption below
- Image treatment: full-width within card, no rounded corners on image
- Text: FerrariSans heading (16–24px) + Body-Font caption (12–13px uppercase)

**Dark Cinematic Card** (Hero/feature sections):
- Background: `#000000` (Absolute Black)
- Full-bleed imagery with text overlay
- No border, no shadow — the darkness IS the container
- Text: white, positioned with careful negative space

**Vehicle Lineup** (Model carousel):
- Horizontal scrollable row of vehicle thumbnails
- Each vehicle on a neutral/white background
- Navigation: arrow buttons + dot indicators
- Background shifts to showcase the selected model's color context

### Inputs & Forms

**Newsletter Input** (Footer section):
- Background: transparent on dark surface
- Text: white
- Border: 1px solid `#CCCCCC`
- Placeholder: `#969696` (Silver Gray)
- Focus: border color transitions (standard browser focus ring)
- Label: Body-Font uppercase, 12px, 1px letter-spacing

**Cookie Consent** (Modal):
- Background: white
- Border radius: 8px (dialog)
- Shadow: `rgb(153, 153, 153) 1px 1px 1px 0px`
- Buttons: oversized (45px Arial), white bg with black border
- Uses standard PrimeReact/Element Plus modal framework

### Navigation
- **Desktop**: Prancing Horse logo centered at top of page, primary navigation below — not a traditional horizontal nav bar but a full-width header block on black background
- **Logo**: Centered Prancing Horse emblem (44×42px) on absolute black — the single most prominent UI element
- **Links**: FerrariSans, 13px, weight 600, white text on dark backgrounds
- **Mobile**: Hamburger collapse to vertical navigation drawer
- **Footer**: Multi-column layout on `#303030` (Dark Surface) with category links in Body-Font uppercase
- **No sticky nav behavior** observed — the page scrolls naturally with the header moving off-screen

### Image Treatment
- **Hero**: Full-width editorial photography on black backgrounds — concept cars in atmospheric studio lighting, editorial portraits with cinematic composition
- **Aspect ratios**: Mixed — landscape (16:9) for hero sections, near-square for portrait/driver imagery, wide panoramic for vehicle lineups
- **Full-bleed vs padded**: Hero images are full-bleed edge-to-edge; editorial content images are padded within white containers
- **Lazy loading**: Below-fold sections use progressive loading (PrimeReact framework handles this)
- **Image quality**: High-resolution photography with studio lighting — no user-generated or lifestyle imagery. Every image is art-directed

### Carousel Component
- Editorial carousel with multiple slides
- Dot indicators for slide position
- Arrow navigation (left/right) at slide edges
- Auto-advancing with manual override
- Content: mixed editorial — event recaps, model launches, racing highlights

## 5. Layout Principles

### Spacing System
- **Base unit**: 8px (detected system base)
- **Scale**: 1px, 2px, 4px, 5px, 6px, 9px, 10px, 11.2px, 12px, 13px, 15px, 16px, 19px, 20px, 25px
- **Button padding**: 12px vertical, 10px horizontal — compact and precise
- **Section padding**: Generous vertical spacing (40–80px estimated) between major content blocks
- **Card gaps**: 16–20px between grid items
- **Footer padding**: 25px horizontal sections within the dark footer block

### Grid & Container
- **Max width**: 1920px (largest breakpoint) with content constraining at narrower widths
- **Hero**: Full-bleed on black, content centered
- **Editorial sections**: 2-column layouts with image + text, alternating sides
- **Vehicle lineup**: Horizontal scroll/carousel, 5–6 models visible at desktop width
- **Footer**: 4-column grid for link categories

### Whitespace Philosophy
Ferrari treats white space as a gallery wall. Each section — whether a concept car render on black void or a pair of F1 drivers on neutral gray — is given its own "room" of breathing space. The alternating black/white sections create a pacing rhythm: dark = immersive moment, white = editorial content, dark = immersive moment. This cadence makes scrolling feel like turning pages in a luxury publication. White space between editorial cards is moderate (not Tesla-extreme) because Ferrari is telling stories, not exhibiting single objects.

### Border Radius Scale
| Value | Context |
|-------|---------|
| 1px | Subtle softening on small inline elements (spans) |
| 2px | Default for buttons, inputs, and interactive elements — barely perceptible, razor-precision |
| 8px | Modal dialogs and overlay containers — the "softest" structural radius |
| 50% | Circular elements: carousel dots, avatar thumbnails, slider handles |

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Level 0 (Flat) | No shadow, no border | Default state for all content sections and cards |
| Level 1 (Subtle) | `rgb(153, 153, 153) 1px 1px 1px 0px` | Rare — cookie consent dialogs and dropdown menus |
| Level 2 (Overlay) | `hsla(0, 0%, 7%, 0.8)` backdrop | Modal overlays and image caption backgrounds |
| Level 3 (Border) | `1px solid #CCCCCC` | Input fields, form containers — depth through delineation not shadow |

### Shadow Philosophy
Ferrari's approach to elevation is nearly as flat as Tesla's, but with a different rationale. Where Tesla avoids shadows for minimalism, Ferrari avoids them because the editorial photography provides all the visual depth needed. The single shadow token (`rgb(153, 153, 153) 1px 1px 1px 0px`) is extremely subtle — a 1-pixel whisper used only in utilitarian contexts like consent dialogs. The site communicates hierarchy through three strategies:
1. **Surface color contrast**: Black sections vs. white sections create unmistakable layering
2. **Overlay transparency**: The `--f-color-overlay-darker` at 80% opacity creates depth without shadow
3. **Photographic depth**: Studio-lit car imagery with reflections, ground shadows, and atmospheric haze provides all the visual dimensionality

### Decorative Depth
- No UI gradients, no glows, no blur effects on interface elements
- The Prancing Horse logo on black creates a "floating in void" effect through pure contrast — no glow or shadow needed
- Dark-to-light section transitions are hard cuts, not gradient blends — reinforcing the editorial page-turn metaphor

## 7. Do's and Don'ts

### Do
- Use Ferrari Red (`#DA291C`) sparingly — only for primary CTAs and brand-critical moments. Its power comes from restraint
- Alternate between black cinematic sections and white editorial sections to create the signature chiaroscuro rhythm
- Use FerrariSans at weight 500 as the default heading voice — it's the typographic equivalent of the engine note
- Apply Body-Font in uppercase with 1px letter-spacing for all labels, category tags, and structural annotations
- Keep border-radius at 2px for all interactive elements — razor precision, not rounded friendliness
- Let photography carry the emotional weight — every image should be art-directed studio quality
- Use the Prancing Horse emblem as a standalone hero element on black — never crowd it with adjacent content
- Maintain the 12px/10px button padding ratio — compact, purposeful, no excess
- Use `#181818` (Near Black) for body text instead of pure `#000000` — the subtle warmth improves readability
- Reserve the yellow accents (`#FFF200`, `#F6E500`) strictly for motorsport and racing heritage contexts

### Don't
- Scatter Ferrari Red across the interface as decoration — it's a CTA signal, not a theme color
- Use rounded-pill buttons or large border-radii — the 2px precision is non-negotiable
- Add box-shadows to cards or content containers — depth comes from surface color contrast and photography
- Mix FerrariSans and Body-Font within the same text block — they serve separate hierarchical functions
- Use colorful backgrounds (blue, green, etc.) for sections — the palette is exclusively black/white/gray with red and yellow accents
- Apply text transforms to FerrariSans headings — uppercase is reserved for Body-Font labels only
- Display low-quality or user-generated imagery — every photograph must meet editorial standards
- Use the Link Hover Blue (`#3860BE`) for anything other than interactive hover states — it's not a brand color
- Create busy layouts with multiple competing focal points — each section should have one clear story
- Override the semantic color system (warning, success, info) with brand colors — `#F13A2C` warning is deliberately different from `#DA291C` brand red

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile Small | ≤375px | Single-column, minimal padding (12px), stacked navigation, hero text scales to ~18px, full-width CTAs |
| Mobile | 376–600px | Single-column, slightly larger padding (16px), hamburger nav, body text at 13px |
| Tablet Small | 601–768px | 2-column editorial grid begins, hero images maintain full-width, footer switches to 2-column |
| Tablet | 769–960px | Full 2-column layout, carousel shows 3 vehicles, padding increases to 20px |
| Desktop | 961–1280px | Full navigation, 2-column editorial with larger imagery, vehicle lineup shows 5 models |
| Large Desktop | 1281–1920px | Maximum content width, generous whitespace, hero photography at full cinematic scale |

### Touch Targets
- Primary CTA buttons: minimum 44px height with 12px vertical padding (meets WCAG AAA 44×44px target)
- Navigation links: 13px text with 1.50 line-height and adequate spacing between items
- Carousel arrows: 44px+ touch targets at viewport edges
- Footer links: grouped with sufficient vertical spacing (16–20px) for touch accuracy

### Collapsing Strategy
- **Navigation**: Full horizontal nav collapses to centered Prancing Horse logo + hamburger menu on mobile
- **Editorial sections**: 2-column image+text layouts collapse to single-column with image stacking above text
- **Vehicle lineup**: Horizontal carousel maintains scroll behavior but reduces visible models from 5 to 2–3
- **Footer**: 4-column link grid collapses to 2-column on tablet, single-column accordion on mobile
- **Hero carousel**: Full-width at all breakpoints, dot indicators and arrows scale proportionally
- **Spacing reduction**: Section padding reduces from 40–80px (desktop) to 20–40px (mobile), maintaining proportional breathing room

### Image Behavior
- Hero images: full-bleed at all breakpoints, using `object-fit: cover` to maintain cinematic composition
- Editorial images: responsive within their containers, maintaining aspect ratio
- Vehicle lineup: thumbnail size scales but maintains consistent car-to-frame proportions
- Art direction: mobile crops may tighten on vehicle subjects, reducing environmental context
- Lazy loading: PrimeReact handles progressive image loading for below-fold content

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: "Ferrari Red (#DA291C)"
- Background Light: "Pure White (#FFFFFF)"
- Background Dark: "Absolute Black (#000000)"
- Secondary Dark Surface: "Dark Surface (#303030)"
- Heading text (light bg): "Near Black (#181818)"
- Body text: "Dark Gray (#666666)"
- Tertiary text: "Mid Gray (#8F8F8F)"
- Border: "Border Gray (#CCCCCC)"
- Button Hover: "Teal (#1EAEDB)"
- Link Hover: "Link Blue (#3860BE)"

### Example Component Prompts
- "Create a hero section on Absolute Black (#000000) background with a centered logo emblem at the top, generous vertical spacing (80px+), and a single editorial headline in FerrariSans at 26px weight 500 in white, with a small Body-Font uppercase caption (12px, 1px letter-spacing) in Silver Gray (#969696) below"
- "Design a Subscribe section on Dark Surface (#303030) with a left-aligned headline in white FerrariSans (24px/500), a subtitle in Mid Gray (#8F8F8F, 13px), an email input with transparent background and 1px #CCCCCC border, and a Ferrari Red (#DA291C) Subscribe button with white text, 2px border-radius, and 12px 10px padding"
- "Build an editorial card on white background with a full-width image (16:9 ratio) above, a FerrariSans heading (16px/700, Near Black #181818) below, and a Body-Font uppercase label (11px, 1px letter-spacing, Mid Gray #8F8F8F) as the category tag — no border, no shadow, no border-radius"
- "Create a vehicle lineup carousel showing 5 car thumbnails in a horizontal scroll on white background, with left/right arrow navigation, dot indicators below, and a FerrariSans model name (16px/500) beneath each vehicle"
- "Design a dark cinematic section with full-bleed studio photography of a concept car on Absolute Black, a white FerrariSans headline (26px/500) positioned in the lower-left with generous padding (40px), and a Ghost Button (transparent bg, 1px white border, white text, 2px radius) as the CTA"

### Iteration Guide
When refining existing screens generated with this design system:
1. Focus on ONE component at a time — Ferrari's editorial rhythm means each section is a self-contained vignette
2. Reference specific color names and hex codes from this document — the palette is small but each color has a precise role
3. Use natural language descriptions, not CSS values — "razor-sharp 2px corners" conveys intent better than "border-radius: 2px"
4. Describe the desired "feel" alongside specific measurements — "editorial magazine page-turn between sections" communicates the layout philosophy better than "margin-bottom: 80px"
5. Always maintain the chiaroscuro contrast — if a section feels flat, check whether it needs to be on black or white to maintain the alternating rhythm
6. Reserve Ferrari Red for ONE element per screen — if red appears in more than one place, it loses its authority

## 10. EMACH Custom Components & Tokens

### Token additions (`packages/ui/src/styles/globals.css`)

Brand tokens live in `:root` **and** are registered in `@theme inline` so Tailwind utilities (`bg-emach-red`, `text-gray-60`, `bg-image-bg`, etc.) are generated automatically.

**Brand palette**:
`--emach-red` (#DA291C), `--emach-red-hover` (#B01E0A), `--emach-red-deep` (#9D2211), `--near-black` (#181818), `--gray-10/20/50/55/60/90`, `--warning` (#F13A2C), `--success` (#16A34A), `--info` (#4C98B9), `--link-hover` (#3860BE).

**Surface / gradient stops** (supplementing brand palette):
`--black` (#000), `--image-bg` (#ECECEC — product placeholder tile), `--cinema-1/2/3` (#2A2A2A / #1A1A1A / #0A0A0A — cinematic hero gradients), `--placeholder-light/mid/dark` (#F6F6F6 / #D8D8D8 / #C8C8C8 — radial used when product has no image).

**Radii**: `--radius-xs` 4px → `--radius-full` 9999px. Default shadcn `--radius: 2px` applied to all components.

**Spacing scale**: `--space-1` 4px → `--space-20` 80px (8px base).

### Design-system utility classes (backgrounds that would be ugly as arbitrary values)

Only use these for their named intent — do not inline equivalents:

| Class | Purpose |
|-------|---------|
| `.emach-bg-cinema` | Hero radial gradient `#2a2a2a → #0a0a0a → #000` |
| `.emach-bg-diagonal` / `.emach-bg-diagonal-2` | Editorial repeating stripe overlays (hero + category tiles) |
| `.emach-mask-vignette` | Radial mask on hero product photo |
| `.emach-bg-stats` | `linear-gradient(135deg, --cinema-2, --black)` — stats panel |
| `.emach-bg-vignette-bottom` | Bottom-anchored darken for tiles over imagery |
| `.emach-bg-category-overlay` | Slight darken used on category tile with image |
| `.emach-bg-category-fallback` | Dark fallback for category tile without image |
| `.emach-bg-card-hover` | Bottom gradient that fades in on product card hover |
| `.emach-bg-placeholder` / `.emach-bg-placeholder-shadow` | Radial + shadow for product icon placeholder |

### Radius philosophy (final)
Default: **2px** on all interactive elements (buttons, inputs, cards, chips, badges). Nearly imperceptible — reinforces the "precision engineering" aesthetic. Only exception: radio/circle indicators use 50%.

### Form controls
All form controls use `.emach-*` CSS classes defined in globals.css. Do NOT use shadcn Input/Select for EMACH-branded pages.
- `.emach-input` — hairline border, red `inset 0 -2px` focus underline, 2px radius
- `.emach-input--dark` — dark surface variant for footer/modals
- `.emach-select` — custom chevron SVG, same focus treatment
- `.emach-check` — black filled checked state
- `.emach-radio` — red dot inner checked state
- `.emach-chip` / `.emach-chip--active` — voltage/filter pills
- `.emach-qty` / `.emach-qty__btn--plus` — quantity stepper; **plus button is always red** (`var(--accent)`)
- `.emach-field`, `.emach-field__label`, `.emach-field__error` — label wrapper

### Ticker marquee
Red banner at top of page (above header) in layout.tsx. Classes `.emach-ticker` / `.emach-marquee` with `@keyframes marquee` 48s loop. Component: `src/components/ticker.tsx`.

### ProductCard quick-add
Red button (`var(--emach-red)`) appears top-right corner on hover. Slides in from top (`translateY(-8px)` → `0`). Icon: lucide `Plus`. Text "+" buttons system-wide follow same rule.

### CategoryTile hover
- Red accent bar animates from `width: 0` to `width: 100%` at bottom of tile
- Arrow icon (`ArrowRight`) turns red on hover; text "Explorar" stays white (not red)
- Tile background subtly scales up `1.05` on hover

### ProductImage
Lucide icon placeholder per category slug: `eletricas→Drill`, `manuais→Wrench`, `medicao→Ruler`, `seguranca→Shield`, `acessorios→Disc3`. Radial gradient background. Component: `src/components/product-image.tsx`.

### Cart state
Client-side cart via React Context + localStorage (`emach:cart`). Provider in `src/lib/cart-context.tsx`. Store helpers in `src/lib/cart-store.ts`. Cart count badge in SiteHeader updates reactively.

### Shared layout primitives (`apps/web/src/components/`)

New DRY helpers. Prefer composing these over raw markup when the pattern applies:

- **`<PageContainer>`** — `mx-auto max-w-[1440px] px-10`. Accepts `as="section|main"` and `bleed` (drops `max-w`). Replaces every `mx-auto max-w-[1440px]` in the codebase.
- **`<SectionHeader>`** — `SectionLabel + <h2> + optional "Ver todas" link`. Drives every home-page section header. `titleSize="md|lg"` swaps 28px ↔ 44px.
- **`<QuantityStepper>`** — Canonical `emach-qty` stepper (buttons − / val / +). `compact` scales to 85% for cart rows. Plus button always red via `.emach-qty__btn--plus`.
- **`<FreeShippingProgress>`** — Shared bar used in `CartSheet` and `CartContent`. Pulls `FREE_SHIPPING_THRESHOLD` from `lib/constants.ts`. Dynamic width is passed through `--pct` CSS custom property + Tailwind `w-(--pct)` (no style-object for colors/layout).
- **`<CartItemRow>`** — Single source of truth for cart rows. `variant="compact"` for the drawer, `variant="full"` for the cart page.

### Brand components refactored to cva

`EmachButton`, `EmachBadge`, `SectionLabel` now follow the same `cva` pattern as shadcn primitives (`buttonVariants`, `badgeVariants`). Variant names and resulting CSS are **identical** to before — the refactor is internal DX only. Consumers pass `variant="..."` and optionally `className` to override.

### shadcn components now adopted

| shadcn | Replaces | Notes |
|--------|----------|-------|
| `<Tabs variant="line">` | Manual `border-b active` tab strips | Emits a **red** underline (`after:bg-emach-red`) on the active trigger — this is a **shadcn override** baked into `packages/ui/src/components/tabs.tsx` (EMACH is law). Consumers pass `className="h-auto flex-1 border-none px-0 py-3.5 text-[13px]/[14px] font-semibold ..."` to match the EMACH chrome |
| `<Dialog>` | Custom zoom modal inside `ProductGallery` | shadcn supplies focus trap, escape handler and scroll lock. Override `className="bg-black/95 p-0 border-none ring-0"` for the image viewer |
| `<Separator>` | `<hr>` / `<div className="h-px bg-border" />` | Used in cart summary total divider, login "ou" divider, footer bottom rule, related-products band |

### Typography utilities

Use the size scale from §3 "Hierarchy (EMACH — actual implementation)" via Tailwind arbitrary values (`text-[14px]`, etc.) combined with `font-sans` (Barlow) or `font-display` (Barlow Condensed). The legacy `.h1/.h2/.h3/.subheading/.body/.label/.micro-label/.price` utility classes have been removed from `globals.css` — never reintroduce them.
