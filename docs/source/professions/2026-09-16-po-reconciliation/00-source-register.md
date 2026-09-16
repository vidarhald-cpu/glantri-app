# Source register and interpretation

**Authority:** source/content authoring only, dated 15 September 2026. L is the controlling legacy artifact; P is the accepted target Profession proposal under the current user instruction. New reconciliation and availability judgments are labelled as authoring, not previously recovered decisions. No runtime migration or acquisition rule is implied.

| Key | Local source                                                                                                                    | SHA-256                                                          | Use                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| L   | L (`/Users/vidarhald/.codex/visualizations/2026/09/11/01a09263-8f3a-7350-9607-f3889122c8f4/forgejo-107-profession-recovery.md`) | 1f53176bb22cc26b1bed410a706fbdd20061cc768230a3f244370e8d64338022 | Controlling 96-identity legacy recovery; its printed totals conflict with its summary.                           |
| P   | P (`/Users/vidarhald/Documents/Glantri local/Glantri_Full_Profession_Catalogue_PO_Proposal.md`)                                 | 548a81ec323321609fb7af1a2a78459450556dc32a4df5818965c10b2b48def6 | Accepted 84 families / 115 LG / 88 direct opportunities; original [P] labels retained as source provenance.      |
| G   | G (`/Users/vidarhald/Documents/Glantri local/Glantri_Full_Catalogue_Learning_Groups_PO_Proposal.md`)                            | 7452da9e5fb0b324ea74b3eb618472c512d3c3f04288a49f124fa50821790423 | Base full Learning Group proposal, amended by M; never use the obsolete 52 count as the final roster.            |
| M   | M (`/Users/vidarhald/Documents/Glantri local/Glantri_Learning_Groups_Martial_Revision_PO_Proposal.md`)                          | f44447d438fc33f0a37cc3703bb33d711f4423b95c9c0e047691ea4a12004e8a | Final martial amendment: G08/F30/F31/F32 replacements and F35-F41 additions; final 59 groups.                    |
| C   | C (`/Users/vidarhald/Documents/Glantri local/Glantri_Complete_Competency_Catalogue_Reader_Prose.md`)                            | 0bedd313d7d49b3cf4846008b75bf126cf956a985f8d1cc9dcab1ef9446b8376 | Exact 172 competency identities and contextual scope. Its old group annotations are superseded by G+M.           |
| H   | H (`/Users/vidarhald/Documents/Glantri local/Candidate4_Availability_Content_Pass_Proposal.md`)                                 | 6b7cea1aad922b12a005b57bbf2f9d15f9f7db02d5038bf49a9228178b7b6b95 | Earlier availability evidence only; 44-Skill/Pilot scope and old G08 cannot establish final target availability. |

## Authority and limits

- The recovered historical baseline and blob IDs below are copied from L, not checked against current dev. No current branch, repository implementation, service, database or remote issue state was inspected or changed.
- L reports historical baseline `33a85bdb949896a5f046554f0c00769a855314f3`, tree `5fcb64948a43b36ef8a2c7b9cba90bc9341eeb12`, canonical-content blob `cb94eeed75c2c91ca88a5997f555250f6cfb1c9a`, and raw Professions.xlsx blob `278ba1d6a7de1a188c2088b6a44e53a211986348`. The normalized bundle and generator are provenance names only; neither was used to replace L.
- L's old statement that all 96 mappings were unresolved describes recovery before this authoring task. The requested new occupational reconciliation does not claim a historical crosswalk existed.
- P's statement that the 96 inventory was missing is superseded for identity recovery by the supplied L. Its target catalogue, member identities, alternatives and boundaries are retained. The 518 accounting remains qualified by E00.
- The prior conversation supplied the task contract only. It supplied no additional attachment, earlier completed mapping or PO resolution.
- Historical links inside the source documents were not independently reopened. This package reports what the supplied sources support and does not claim new historical verification.
- Source line references identify the local versions hashed above. `L001` etc. are new ledger occurrence references, not original row IDs. Original source row IDs and global storage order are not present in L.

## Legacy society-code correspondence

| L code | Target review code | Exact recovered society ID    | Recovered Level (evidence) |
| ------ | ------------------ | ----------------------------- | -------------------------- |
| F      | S01                | forager_ritual_tribal         | 1                          |
| P      | S02                | pastoral_clan_nomadic         | 2                          |
| E      | S03                | early_agrarian_proto_state    | 2                          |
| B      | S04                | bronze_age_palace_state       | 3                          |
| T      | S05                | temple_state_literate         | 3                          |
| I      | S06                | imperial_agrarian_bureaucracy | 4                          |
| M      | S07                | feudal_manorial_kingdom       | 4                          |
| C      | S08                | classical_polis_city_state    | 5                          |
| H      | S09                | imperial_classical_high_civ   | 5                          |
| K      | S10                | court_bureaucratic_empire     | 5                          |
| R      | S11                | renaissance_city_state        | 6                          |
