# Tirvona SEO Architecture & Documentation

This folder is the central repository for Tirvona's SEO assets, keyword mappings, content copy, and technical documentation.

## Directory Structure

```
seo/
├── README.md               # This architecture and workflow guide
├── sources/                # Authoritative source files from the SEO team
│   ├── Tirvona_SEO_Professional_Curated_Keyword_Mapping_Final (1).xlsx
│   ├── Tirvona_SEO_Keyword_to_Page_Mapping.xlsx
│   └── Tirvona_6_Groups_SEO_Landing_Page_Copy (2).docx
└── docs/                   # Parsed and extracted content files
    ├── docx_copy.txt       # Extracted approved copy for all 6 landing page groups
    ├── curated_mapping_final.tsv # Tab-delimited keyword mapping & search volume
    └── keyword_to_page.tsv # Tab-delimited mapping of keywords to URLs & sections
```

---

## The Six Primary Landing Page Groups

| # | Group | Focus | Canonical Route | Code Location |
|---|---|---|---|---|
| 1 | **Vrindavan Main Hub** | Comprehensive stay and temple hub | `/ashrams/vrindavan` | `frontend/src/seo/VrindavanStaysPage.tsx` |
| 2 | **Banke Bihari Temple** | Temple proximity stays & parking | `/stays-near-banke-bihari-vrindavan` | `frontend/src/seo/BankeBihariStaysPage.tsx` |
| 3 | **Prem Mandir** | Temple proximity & dharamshalas | `/stays-near-prem-mandir-vrindavan` | `frontend/src/seo/PremMandirStaysPage.tsx` |
| 4 | **ISKCON Vrindavan** | Temple proximity & guesthouses | `/stays-near-iskcon-vrindavan` | `frontend/src/seo/IskconStaysPage.tsx` |
| 5 | **Budget Stays** | Dharamshalas, low-cost stays (<₹1000) | `/budget-stays-in-vrindavan` | `frontend/src/seo/BudgetStaysPage.tsx` |
| 6 | **Family Stays** | Multi-bed rooms, AC, security | `/family-stays-in-vrindavan` | `frontend/src/seo/FamilyStaysPage.tsx` |

---

## Core SEO Principles Implemented

1. **Section Architecture over URL Bloat:** Rather than creating a separate URL for every long-tail keyword (which causes keyword cannibalization and low-quality pages), keywords are logically grouped into thematic H2 sections and real dynamic filter tabs.
2. **Canonical URLs:** Production canonical links strictly use `https://www.tirvona.com/<route>`.
3. **Dynamic Live Inventory:** All cards pull live from `ashramService.search({ city: 'Vrindavan' })` with Haversine distance calculations from verified temple coordinates.
4. **Valid Schema Markup:** Each page embeds dynamic `BreadcrumbList`, `ItemList` (with real `LodgingBusiness` items and live pricing), and `FAQPage` schemas matching visible content.
5. **No SEO Fabrication:** Real prices, real amenities, real distances, and real Tirvona Trusted statuses are rendered directly from the database.
