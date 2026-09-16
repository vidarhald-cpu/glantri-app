# Accounting for the claimed 518 legacy associations

**Authority:** source/content authoring only, dated 15 September 2026. L is the controlling legacy artifact; P is the accepted target Profession proposal under the current user instruction. New reconciliation and availability judgments are labelled as authoring, not previously recovered decisions. No runtime migration or acquisition rule is implied.

## Finding: exact 518-row ownership is not established

| Measure                    | L summary claims | Printed ledger recount | Variance |
| -------------------------- | ---------------- | ---------------------- | -------- |
| Total                      | 518              | 523                    | +5       |
| Family-scoped              | 46               | 49                     | +3       |
| Profession-scoped          | 472              | 474                    | +2       |
| Group references           | 294              | 299                    | +5       |
| Ordinary Skill references  | 149              | 149                    | 0        |
| Secondary Skill references | 75               | 75                     | 0        |

**E00 — controlling-source inconsistency.** There are 523 printed occurrences, all transcribed below. No five were dropped to force the headline 518. All have `ranks: 0` as reported by L, and the exact scope, owner, core/favored flag and stored reference are retained. No target semantic conversion is made.

The same sequence is printed under both family `healer` and Profession `healer`: `G+:healing_practice, G~:herb_and_remedy_craft, G+:healing_practice, G+:herb_and_remedy_craft, G~:mental_discipline`.

| Scope             | Occurrence IDs | Source       | Printed rows |
| ----------------- | -------------- | ------------ | ------------ |
| family healer     | L011–L015      | L:246        | 5            |
| profession healer | L221–L225      | L:181; L:301 | 5            |

**Plausible explanation, not a correction:** this is consistent with a same-ID scope collision that duplicated a five-row combined sequence into both lists. If all five excess occurrences came from that collision and every other printed row is correct, the claimed scope totals would require **2 family rows and 3 Profession rows** among those five logical rows. L does not prove which entries belong to which scope, whether the repeated core healing row represents two distinct objects, or whether the summary itself is correct. Ordering is not a basis for allocating them.

**Exact missing evidence:** the source-owned association objects for the `healer` family and Profession, with distinct owner/scope fields, multiplicity and the count basis used for the 518/46/472/294 claims. A corrected scoped extract or authoritative erratum is sufficient; no current-dev inspection, migration or runtime change is needed. If the suspected collision is disproved, the original summary requires correction against the full source-owned scoped export.

Simple within-scope identical-token deduplication removes only two occurrences and produces **521**, so it does not reconcile 518. Removing all five family-healer occurrences would produce 44 family and 474 Profession rows, also contradicting the claimed split. Both lossy shortcuts are rejected.

## Counting rules

- Count each printed association occurrence once under its printed owner/scope, including duplicate tokens.
- Family rows are retained once in the corpus and cross-referenced from identities; never replicate them into every member Profession's direct count.
- `G` means stored `skillGroupId`; `O` and `S` mean stored `skillId`, retaining the source's ordinary/secondary distinction. These are legacy types, not target type rulings.
- `+` means core; `~` means favored. Neither becomes a target grant or requirement.
- Learning-History indirection is not included in these printed rows. The separate history-evidence register records what is and is not recovered.
- Availability membership, alias handling, occupational context and restrictions are separate evidence, not additional association rows.

## All family-scoped printed occurrences — 49

| Occurrence | Owner ID          | Stored field | Exact stored reference     | Legacy kind     | Flag    | Ranks | Source |
| ---------- | ----------------- | ------------ | -------------------------- | --------------- | ------- | ----- | ------ |
| L001       | scholar_scribe    | skillGroupId | literate_foundation        | group           | core    | 0     | L:243  |
| L002       | scholar_scribe    | skillGroupId | civic_learning             | group           | favored | 0     | L:243  |
| L003       | courtier_diplomat | skillGroupId | courtly_formation          | group           | core    | 0     | L:245  |
| L004       | courtier_diplomat | skillGroupId | political_acumen           | group           | favored | 0     | L:245  |
| L005       | courtier_diplomat | skillId      | language                   | ordinary skill  | favored | 0     | L:245  |
| L006       | courtier_diplomat | skillId      | law                        | ordinary skill  | favored | 0     | L:245  |
| L007       | courtier_diplomat | skillId      | rhetorical_composition     | secondary skill | favored | 0     | L:245  |
| L008       | courtier_diplomat | skillId      | detect_lies                | secondary skill | favored | 0     | L:245  |
| L009       | courtier_diplomat | skillId      | administration             | ordinary skill  | favored | 0     | L:245  |
| L010       | courtier_diplomat | skillId      | social_perception          | secondary skill | favored | 0     | L:245  |
| L011       | healer            | skillGroupId | healing_practice           | group           | core    | 0     | L:246  |
| L012       | healer            | skillGroupId | herb_and_remedy_craft      | group           | favored | 0     | L:246  |
| L013       | healer            | skillGroupId | healing_practice           | group           | core    | 0     | L:246  |
| L014       | healer            | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:246  |
| L015       | healer            | skillGroupId | mental_discipline          | group           | favored | 0     | L:246  |
| L016       | engineer_builder  | skillGroupId | technical_measurement      | group           | core    | 0     | L:247  |
| L017       | engineer_builder  | skillId      | surveying                  | ordinary skill  | favored | 0     | L:247  |
| L018       | engineer_builder  | skillId      | mechanics                  | ordinary skill  | favored | 0     | L:247  |
| L019       | engineer_builder  | skillId      | administration             | ordinary skill  | favored | 0     | L:247  |
| L020       | engineer_builder  | skillId      | smithing                   | ordinary skill  | favored | 0     | L:247  |
| L021       | engineer_builder  | skillId      | mathematics                | ordinary skill  | favored | 0     | L:247  |
| L022       | sailor_navigator  | skillGroupId | maritime_crew_training     | group           | core    | 0     | L:248  |
| L023       | sailor_navigator  | skillGroupId | maritime_navigation        | group           | favored | 0     | L:248  |
| L024       | sailor_navigator  | skillId      | boat_handling              | secondary skill | favored | 0     | L:248  |
| L025       | sailor_navigator  | skillId      | ropework                   | secondary skill | favored | 0     | L:248  |
| L026       | sailor_navigator  | skillId      | language                   | ordinary skill  | favored | 0     | L:248  |
| L027       | sailor_navigator  | skillId      | trading                    | ordinary skill  | favored | 0     | L:248  |
| L028       | sailor_navigator  | skillId      | insight                    | ordinary skill  | favored | 0     | L:248  |
| L029       | herdsman_rider    | skillGroupId | animal_husbandry           | group           | favored | 0     | L:249  |
| L030       | herdsman_rider    | skillGroupId | mounted_service            | group           | favored | 0     | L:249  |
| L031       | herdsman_rider    | skillGroupId | transport_and_caravan_work | group           | favored | 0     | L:249  |
| L032       | herdsman_rider    | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:249  |
| L033       | thief_infiltrator | skillGroupId | street_theft               | group           | favored | 0     | L:250  |
| L034       | thief_infiltrator | skillGroupId | covert_entry               | group           | favored | 0     | L:250  |
| L035       | thief_infiltrator | skillGroupId | fieldcraft_stealth         | group           | favored | 0     | L:250  |
| L036       | thief_infiltrator | skillId      | detect_lies                | secondary skill | favored | 0     | L:250  |
| L037       | thief_infiltrator | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:250  |
| L038       | thief_infiltrator | skillId      | conceal_object             | secondary skill | favored | 0     | L:250  |
| L039       | thief_infiltrator | skillId      | camouflage                 | secondary skill | favored | 0     | L:250  |
| L040       | performer         | skillGroupId | performance_basics         | group           | favored | 0     | L:251  |
| L041       | performer         | skillGroupId | formal_performance         | group           | favored | 0     | L:251  |
| L042       | performer         | skillId      | seduction                  | secondary skill | favored | 0     | L:251  |
| L043       | performer         | skillId      | disguise                   | secondary skill | favored | 0     | L:251  |
| L044       | performer         | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:251  |
| L045       | performer         | skillId      | language                   | ordinary skill  | favored | 0     | L:251  |
| L046       | performer         | skillId      | rhetorical_composition     | secondary skill | favored | 0     | L:251  |
| L047       | performer         | skillId      | singing                    | ordinary skill  | favored | 0     | L:251  |
| L048       | performer         | skillId      | dancing                    | ordinary skill  | favored | 0     | L:251  |
| L049       | soldier           | skillGroupId | veteran_soldiering         | group           | favored | 0     | L:252  |

## All Profession-scoped printed occurrences — 474

| Occurrence | Owner ID                 | Stored field | Exact stored reference     | Legacy kind     | Flag    | Ranks | Source |
| ---------- | ------------------------ | ------------ | -------------------------- | --------------- | ------- | ----- | ------ |
| L050       | temple_scribe            | skillGroupId | literate_foundation        | group           | core    | 0     | L:264  |
| L051       | temple_scribe            | skillGroupId | civic_learning             | group           | core    | 0     | L:264  |
| L052       | temple_scribe            | skillGroupId | sacred_learning            | group           | core    | 0     | L:264  |
| L053       | temple_scribe            | skillGroupId | temple_service             | group           | core    | 0     | L:264  |
| L054       | temple_scribe            | skillGroupId | scholarly_formation        | group           | favored | 0     | L:264  |
| L055       | court_scribe_clerk       | skillGroupId | literate_foundation        | group           | core    | 0     | L:265  |
| L056       | court_scribe_clerk       | skillGroupId | civic_learning             | group           | core    | 0     | L:265  |
| L057       | court_scribe_clerk       | skillGroupId | commercial_administration  | group           | core    | 0     | L:265  |
| L058       | court_scribe_clerk       | skillGroupId | courtly_formation          | group           | core    | 0     | L:265  |
| L059       | court_scribe_clerk       | skillGroupId | scholarly_formation        | group           | favored | 0     | L:265  |
| L060       | local_trader             | skillGroupId | mercantile_practice        | group           | core    | 0     | L:266  |
| L061       | local_trader             | skillGroupId | commercial_administration  | group           | core    | 0     | L:266  |
| L062       | local_trader             | skillId      | language                   | ordinary skill  | core    | 0     | L:266  |
| L063       | local_trader             | skillGroupId | social_reading             | group           | favored | 0     | L:266  |
| L064       | household_courtier       | skillId      | insight                    | ordinary skill  | core    | 0     | L:267  |
| L065       | household_courtier       | skillId      | intrigue                   | ordinary skill  | core    | 0     | L:267  |
| L066       | household_courtier       | skillId      | detect_lies                | secondary skill | favored | 0     | L:267  |
| L067       | household_courtier       | skillId      | seduction                  | secondary skill | favored | 0     | L:267  |
| L068       | household_courtier       | skillId      | social_perception          | secondary skill | favored | 0     | L:267  |
| L069       | folk_healer              | skillGroupId | healing_practice           | group           | core    | 0     | L:268  |
| L070       | folk_healer              | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:268  |
| L071       | folk_healer              | skillGroupId | social_reading             | group           | favored | 0     | L:268  |
| L072       | folk_healer              | skillId      | concentration              | ordinary skill  | favored | 0     | L:268  |
| L073       | builder_master_mason     | skillGroupId | technical_measurement      | group           | core    | 0     | L:269  |
| L074       | builder_master_mason     | skillGroupId | construction_specialty     | group           | core    | 0     | L:269  |
| L075       | builder_master_mason     | skillGroupId | commercial_administration  | group           | core    | 0     | L:269  |
| L076       | builder_master_mason     | skillGroupId | civic_learning             | group           | favored | 0     | L:269  |
| L077       | deck_sailor              | skillGroupId | maritime_crew_training     | group           | core    | 0     | L:270  |
| L078       | deck_sailor              | skillId      | boat_handling              | secondary skill | core    | 0     | L:270  |
| L079       | deck_sailor              | skillId      | ropework                   | secondary skill | favored | 0     | L:270  |
| L080       | deck_sailor              | skillId      | swim                       | secondary skill | favored | 0     | L:270  |
| L081       | herdsman_subtype         | skillGroupId | animal_handling            | group           | core    | 0     | L:271  |
| L082       | herdsman_subtype         | skillGroupId | pastoral_work              | group           | core    | 0     | L:271  |
| L083       | burglar                  | skillGroupId | security                   | group           | core    | 0     | L:272  |
| L084       | burglar                  | skillId      | lockpicking                | ordinary skill  | core    | 0     | L:272  |
| L085       | burglar                  | skillId      | search                     | ordinary skill  | core    | 0     | L:272  |
| L086       | burglar                  | skillGroupId | covert_entry               | group           | favored | 0     | L:272  |
| L087       | burglar                  | skillId      | hide                       | secondary skill | favored | 0     | L:272  |
| L088       | folk_performer           | skillGroupId | performance_basics         | group           | core    | 0     | L:273  |
| L089       | folk_performer           | skillId      | storytelling               | ordinary skill  | core    | 0     | L:273  |
| L090       | folk_performer           | skillId      | singing                    | ordinary skill  | core    | 0     | L:273  |
| L091       | folk_performer           | skillId      | music                      | ordinary skill  | favored | 0     | L:273  |
| L092       | tribal_warrior           | skillGroupId | basic_melee_training       | group           | core    | 0     | L:274  |
| L093       | tribal_warrior           | skillId      | perception                 | ordinary skill  | core    | 0     | L:274  |
| L094       | tribal_warrior           | skillId      | brawling                   | secondary skill | favored | 0     | L:274  |
| L095       | tribal_warrior           | skillId      | throwing                   | secondary skill | favored | 0     | L:274  |
| L096       | tribal_warrior           | skillId      | bow                        | secondary skill | favored | 0     | L:274  |
| L097       | levy_infantry            | skillGroupId | basic_melee_training       | group           | core    | 0     | L:275  |
| L098       | levy_infantry            | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:275  |
| L099       | levy_infantry            | skillId      | perception                 | ordinary skill  | core    | 0     | L:275  |
| L100       | levy_infantry            | skillId      | first_aid                  | secondary skill | favored | 0     | L:275  |
| L101       | levy_infantry            | skillId      | polearms                   | secondary skill | favored | 0     | L:275  |
| L102       | levy_infantry            | skillId      | one_handed_concussion_axe  | secondary skill | favored | 0     | L:275  |
| L103       | levy_infantry            | skillId      | battlefield_awareness      | secondary skill | favored | 0     | L:275  |
| L104       | cavalry_mounted_retainer | skillGroupId | mounted_warrior_training   | group           | core    | 0     | L:276  |
| L105       | cavalry_mounted_retainer | skillGroupId | mounted_service            | group           | core    | 0     | L:276  |
| L106       | cavalry_mounted_retainer | skillGroupId | courtly_formation          | group           | favored | 0     | L:276  |
| L107       | cavalry_mounted_retainer | skillGroupId | route_security             | group           | favored | 0     | L:276  |
| L108       | actor                    | skillGroupId | formal_performance         | group           | core    | 0     | L:277  |
| L109       | actor                    | skillId      | acting                     | ordinary skill  | core    | 0     | L:277  |
| L110       | actor                    | skillId      | recitation                 | secondary skill | core    | 0     | L:277  |
| L111       | actor                    | skillId      | disguise                   | secondary skill | favored | 0     | L:277  |
| L112       | actor                    | skillId      | insight                    | ordinary skill  | favored | 0     | L:277  |
| L113       | actor                    | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:277  |
| L114       | actor                    | skillId      | storytelling               | ordinary skill  | favored | 0     | L:277  |
| L115       | animal_trainer           | skillGroupId | animal_husbandry           | group           | core    | 0     | L:278  |
| L116       | animal_trainer           | skillGroupId | animal_handling            | group           | core    | 0     | L:278  |
| L117       | animal_trainer           | skillGroupId | route_security             | group           | favored | 0     | L:278  |
| L118       | assassin                 | skillGroupId | covert_entry               | group           | core    | 0     | L:279  |
| L119       | assassin                 | skillGroupId | fieldcraft_stealth         | group           | core    | 0     | L:279  |
| L120       | assassin                 | skillId      | stealth                    | ordinary skill  | core    | 0     | L:279  |
| L121       | assassin                 | skillId      | disguise                   | secondary skill | core    | 0     | L:279  |
| L122       | assassin                 | skillId      | search                     | ordinary skill  | favored | 0     | L:279  |
| L123       | assassin                 | skillId      | detect_lies                | secondary skill | favored | 0     | L:279  |
| L124       | assassin                 | skillId      | poison_lore                | ordinary skill  | favored | 0     | L:279  |
| L125       | assassin                 | skillId      | one_handed_edged           | secondary skill | favored | 0     | L:279  |
| L126       | bandit                   | skillGroupId | fieldcraft_stealth         | group           | core    | 0     | L:280  |
| L127       | bandit                   | skillId      | stealth                    | ordinary skill  | core    | 0     | L:280  |
| L128       | bandit                   | skillId      | perception                 | ordinary skill  | core    | 0     | L:280  |
| L129       | bandit                   | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:280  |
| L130       | bandit                   | skillId      | one_handed_concussion_axe  | secondary skill | favored | 0     | L:280  |
| L131       | bandit                   | skillId      | brawling                   | secondary skill | favored | 0     | L:280  |
| L132       | beggar                   | skillId      | insight                    | ordinary skill  | core    | 0     | L:281  |
| L133       | beggar                   | skillId      | bargaining                 | ordinary skill  | core    | 0     | L:281  |
| L134       | beggar                   | skillId      | stealth                    | ordinary skill  | favored | 0     | L:281  |
| L135       | beggar                   | skillId      | social_perception          | secondary skill | favored | 0     | L:281  |
| L136       | beggar                   | skillId      | detect_lies                | secondary skill | favored | 0     | L:281  |
| L137       | bodyguard                | skillGroupId | advanced_melee_training    | group           | core    | 0     | L:282  |
| L138       | bodyguard                | skillGroupId | watch_civic_guard          | group           | core    | 0     | L:282  |
| L139       | bodyguard                | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:282  |
| L140       | bodyguard                | skillGroupId | courtly_formation          | group           | favored | 0     | L:282  |
| L141       | bounty_hunter            | skillId      | search                     | ordinary skill  | core    | 0     | L:283  |
| L142       | bounty_hunter            | skillId      | perception                 | ordinary skill  | core    | 0     | L:283  |
| L143       | bounty_hunter            | skillGroupId | watch_civic_guard          | group           | favored | 0     | L:283  |
| L144       | bureaucrat               | skillGroupId | literate_foundation        | group           | core    | 0     | L:284  |
| L145       | bureaucrat               | skillGroupId | civic_learning             | group           | core    | 0     | L:284  |
| L146       | bureaucrat               | skillGroupId | commercial_administration  | group           | core    | 0     | L:284  |
| L147       | bureaucrat               | skillGroupId | fiscal_administration      | group           | core    | 0     | L:284  |
| L148       | bureaucrat               | skillGroupId | legal_practice             | group           | favored | 0     | L:284  |
| L149       | bureaucrat               | skillGroupId | courtly_formation          | group           | favored | 0     | L:284  |
| L150       | caravan_guard            | skillGroupId | basic_melee_training       | group           | core    | 0     | L:285  |
| L151       | caravan_guard            | skillGroupId | route_security             | group           | favored | 0     | L:285  |
| L152       | caravan_guard            | skillId      | throwing                   | secondary skill | favored | 0     | L:285  |
| L153       | cavalry                  | skillGroupId | mounted_warrior_training   | group           | core    | 0     | L:286  |
| L154       | cavalry                  | skillGroupId | basic_melee_training       | group           | core    | 0     | L:286  |
| L155       | cavalry                  | skillId      | perception                 | ordinary skill  | core    | 0     | L:286  |
| L156       | cavalry                  | skillId      | mounted_combat             | secondary skill | core    | 0     | L:286  |
| L157       | cavalry                  | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:286  |
| L158       | cavalry                  | skillId      | animal_care                | ordinary skill  | favored | 0     | L:286  |
| L159       | cavalry                  | skillId      | battlefield_awareness      | secondary skill | favored | 0     | L:286  |
| L160       | champion                 | skillGroupId | advanced_melee_training    | group           | core    | 0     | L:287  |
| L161       | champion                 | skillGroupId | arena_training             | group           | core    | 0     | L:287  |
| L162       | champion                 | skillGroupId | courtly_formation          | group           | favored | 0     | L:287  |
| L163       | chariot_driver           | skillGroupId | transport_and_caravan_work | group           | core    | 0     | L:288  |
| L164       | chariot_driver           | skillGroupId | mounted_service            | group           | favored | 0     | L:288  |
| L165       | chariot_driver           | skillGroupId | route_security             | group           | favored | 0     | L:288  |
| L166       | chariot_driver           | skillId      | throwing                   | secondary skill | favored | 0     | L:288  |
| L167       | clan_warriors            | skillGroupId | basic_melee_training       | group           | core    | 0     | L:289  |
| L168       | clan_warriors            | skillId      | perception                 | ordinary skill  | core    | 0     | L:289  |
| L169       | clan_warriors            | skillId      | one_handed_concussion_axe  | secondary skill | core    | 0     | L:289  |
| L170       | clan_warriors            | skillId      | throwing                   | secondary skill | favored | 0     | L:289  |
| L171       | clan_warriors            | skillId      | bow                        | secondary skill | favored | 0     | L:289  |
| L172       | clan_warriors            | skillId      | battlefield_awareness      | secondary skill | favored | 0     | L:289  |
| L173       | conman                   | skillGroupId | political_acumen           | group           | core    | 0     | L:290  |
| L174       | conman                   | skillId      | insight                    | ordinary skill  | core    | 0     | L:290  |
| L175       | conman                   | skillId      | disguise                   | secondary skill | core    | 0     | L:290  |
| L176       | conman                   | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:290  |
| L177       | conman                   | skillId      | detect_lies                | secondary skill | favored | 0     | L:290  |
| L178       | conman                   | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:290  |
| L179       | conman                   | skillId      | seduction                  | secondary skill | favored | 0     | L:290  |
| L180       | courtesan                | skillGroupId | courtly_formation          | group           | core    | 0     | L:291  |
| L181       | courtesan                | skillGroupId | political_acumen           | group           | core    | 0     | L:291  |
| L182       | courtesan                | skillId      | seduction                  | secondary skill | core    | 0     | L:291  |
| L183       | courtesan                | skillId      | insight                    | ordinary skill  | core    | 0     | L:291  |
| L184       | courtesan                | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:291  |
| L185       | courtesan                | skillId      | detect_lies                | secondary skill | favored | 0     | L:291  |
| L186       | courtesan                | skillId      | social_perception          | secondary skill | favored | 0     | L:291  |
| L187       | courtesan                | skillId      | intrigue                   | ordinary skill  | favored | 0     | L:291  |
| L188       | crafter                  | skillGroupId | technical_measurement      | group           | core    | 0     | L:292  |
| L189       | crafter                  | skillGroupId | craft_specialty            | group           | core    | 0     | L:292  |
| L190       | docker                   | skillId      | ropework                   | secondary skill | core    | 0     | L:294  |
| L191       | docker                   | skillId      | teamstering                | ordinary skill  | core    | 0     | L:294  |
| L192       | docker                   | skillGroupId | maritime_crew_training     | group           | favored | 0     | L:294  |
| L193       | docker                   | skillId      | sailing                    | ordinary skill  | favored | 0     | L:294  |
| L194       | docker                   | skillId      | animal_care                | ordinary skill  | favored | 0     | L:294  |
| L195       | docker                   | skillId      | run                        | ordinary skill  | favored | 0     | L:294  |
| L196       | embalmer                 | skillGroupId | healing_practice           | group           | core    | 0     | L:295  |
| L197       | embalmer                 | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:295  |
| L198       | embalmer                 | skillGroupId | mortuary_practice          | group           | core    | 0     | L:295  |
| L199       | embalmer                 | skillGroupId | sacred_learning            | group           | favored | 0     | L:295  |
| L200       | entertainer              | skillGroupId | performance_basics         | group           | core    | 0     | L:296  |
| L201       | entertainer              | skillId      | storytelling               | ordinary skill  | core    | 0     | L:296  |
| L202       | entertainer              | skillId      | music                      | ordinary skill  | core    | 0     | L:296  |
| L203       | entertainer              | skillGroupId | formal_performance         | group           | favored | 0     | L:296  |
| L204       | entertainer              | skillId      | singing                    | ordinary skill  | favored | 0     | L:296  |
| L205       | entertainer              | skillId      | dancing                    | ordinary skill  | favored | 0     | L:296  |
| L206       | entertainer              | skillId      | acting                     | ordinary skill  | favored | 0     | L:296  |
| L207       | entertainer              | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:296  |
| L208       | farmer                   | skillGroupId | animal_husbandry           | group           | core    | 0     | L:297  |
| L209       | farmer                   | skillGroupId | farm_household_work        | group           | core    | 0     | L:297  |
| L210       | fisher                   | skillGroupId | maritime_crew_training     | group           | core    | 0     | L:298  |
| L211       | fisher                   | skillGroupId | coastal_fishing            | group           | core    | 0     | L:298  |
| L212       | fisher                   | skillGroupId | mercantile_practice        | group           | favored | 0     | L:298  |
| L213       | fixer                    | skillGroupId | mercantile_practice        | group           | core    | 0     | L:299  |
| L214       | fixer                    | skillGroupId | commercial_administration  | group           | core    | 0     | L:299  |
| L215       | fixer                    | skillGroupId | political_acumen           | group           | favored | 0     | L:299  |
| L216       | fixer                    | skillId      | language                   | ordinary skill  | favored | 0     | L:299  |
| L217       | fixer                    | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:299  |
| L218       | fixer                    | skillId      | banking                    | ordinary skill  | favored | 0     | L:299  |
| L219       | gladiator                | skillGroupId | advanced_melee_training    | group           | core    | 0     | L:300  |
| L220       | gladiator                | skillGroupId | arena_training             | group           | favored | 0     | L:300  |
| L221       | healer                   | skillGroupId | healing_practice           | group           | core    | 0     | L:301  |
| L222       | healer                   | skillGroupId | herb_and_remedy_craft      | group           | favored | 0     | L:301  |
| L223       | healer                   | skillGroupId | healing_practice           | group           | core    | 0     | L:301  |
| L224       | healer                   | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:301  |
| L225       | healer                   | skillGroupId | mental_discipline          | group           | favored | 0     | L:301  |
| L226       | heavy_infantry           | skillGroupId | basic_melee_training       | group           | core    | 0     | L:302  |
| L227       | heavy_infantry           | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:302  |
| L228       | heavy_infantry           | skillId      | parry                      | secondary skill | core    | 0     | L:302  |
| L229       | heavy_infantry           | skillId      | formation_fighting         | secondary skill | core    | 0     | L:302  |
| L230       | heavy_infantry           | skillId      | polearms                   | secondary skill | favored | 0     | L:302  |
| L231       | heavy_infantry           | skillId      | one_handed_concussion_axe  | secondary skill | favored | 0     | L:302  |
| L232       | heavy_infantry           | skillId      | battlefield_awareness      | secondary skill | favored | 0     | L:302  |
| L233       | herald                   | skillGroupId | courtly_formation          | group           | core    | 0     | L:303  |
| L234       | herald                   | skillId      | heraldry                   | ordinary skill  | core    | 0     | L:303  |
| L235       | herald                   | skillId      | oratory                    | ordinary skill  | core    | 0     | L:303  |
| L236       | herald                   | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:303  |
| L237       | herald                   | skillId      | courtly_protocol           | ordinary skill  | favored | 0     | L:303  |
| L238       | herald                   | skillId      | history                    | ordinary skill  | favored | 0     | L:303  |
| L239       | herbalist                | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:304  |
| L240       | herbalist                | skillGroupId | healing_practice           | group           | core    | 0     | L:304  |
| L241       | herbalist                | skillGroupId | mercantile_practice        | group           | favored | 0     | L:304  |
| L242       | herbalist                | skillId      | concentration              | ordinary skill  | favored | 0     | L:304  |
| L243       | herder                   | skillGroupId | pastoral_work              | group           | core    | 0     | L:305  |
| L244       | hermit                   | skillGroupId | mental_discipline          | group           | core    | 0     | L:306  |
| L245       | hermit                   | skillId      | meditation                 | ordinary skill  | core    | 0     | L:306  |
| L246       | hermit                   | skillId      | self_control               | ordinary skill  | core    | 0     | L:306  |
| L247       | hermit                   | skillGroupId | omen_and_ritual_practice   | group           | favored | 0     | L:306  |
| L248       | hermit                   | skillId      | divination                 | ordinary skill  | favored | 0     | L:306  |
| L249       | hermit                   | skillId      | herb_lore                  | ordinary skill  | favored | 0     | L:306  |
| L250       | hermit                   | skillId      | concentration              | ordinary skill  | favored | 0     | L:306  |
| L251       | homemaker                | skillGroupId | craft_group                | group           | core    | 0     | L:307  |
| L252       | homemaker                | skillGroupId | social_reading             | group           | favored | 0     | L:307  |
| L253       | homemaker                | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:307  |
| L254       | hunter                   | skillGroupId | fieldcraft_stealth         | group           | core    | 0     | L:308  |
| L255       | hunter                   | skillId      | perception                 | ordinary skill  | core    | 0     | L:308  |
| L256       | hunter                   | skillId      | stealth                    | ordinary skill  | core    | 0     | L:308  |
| L257       | hunter                   | skillId      | bow                        | secondary skill | favored | 0     | L:308  |
| L258       | hunter                   | skillId      | throwing                   | secondary skill | favored | 0     | L:308  |
| L259       | hunter                   | skillId      | animal_care                | ordinary skill  | favored | 0     | L:308  |
| L260       | hunter                   | skillId      | search                     | ordinary skill  | favored | 0     | L:308  |
| L261       | inn_keeper               | skillGroupId | mercantile_practice        | group           | core    | 0     | L:309  |
| L262       | inn_keeper               | skillGroupId | commercial_administration  | group           | core    | 0     | L:309  |
| L263       | inn_keeper               | skillId      | baking                     | ordinary skill  | core    | 0     | L:309  |
| L264       | inn_keeper               | skillId      | brewing                    | ordinary skill  | core    | 0     | L:309  |
| L265       | inn_keeper               | skillGroupId | social_reading             | group           | favored | 0     | L:309  |
| L266       | jailer                   | skillGroupId | basic_melee_training       | group           | core    | 0     | L:310  |
| L267       | jailer                   | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:310  |
| L268       | jailer                   | skillGroupId | watch_civic_guard          | group           | favored | 0     | L:310  |
| L269       | lawyer                   | skillGroupId | literate_foundation        | group           | core    | 0     | L:311  |
| L270       | lawyer                   | skillGroupId | civic_learning             | group           | core    | 0     | L:311  |
| L271       | lawyer                   | skillGroupId | legal_practice             | group           | core    | 0     | L:311  |
| L272       | lawyer                   | skillGroupId | scholarly_formation        | group           | favored | 0     | L:311  |
| L273       | lawyer                   | skillGroupId | courtly_formation          | group           | favored | 0     | L:311  |
| L274       | lawyer                   | skillGroupId | social_reading             | group           | favored | 0     | L:311  |
| L275       | light_infantry           | skillGroupId | basic_missile_training     | group           | core    | 0     | L:312  |
| L276       | light_infantry           | skillGroupId | basic_melee_training       | group           | core    | 0     | L:312  |
| L277       | light_infantry           | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:312  |
| L278       | master_craftsmen         | skillGroupId | craft_specialty_advanced   | group           | core    | 0     | L:313  |
| L279       | master_craftsmen         | skillGroupId | mercantile_practice        | group           | core    | 0     | L:313  |
| L280       | master_craftsmen         | skillGroupId | commercial_administration  | group           | core    | 0     | L:313  |
| L281       | master_craftsmen         | skillGroupId | technical_measurement      | group           | favored | 0     | L:313  |
| L282       | merchant                 | skillGroupId | mercantile_practice        | group           | core    | 0     | L:314  |
| L283       | merchant                 | skillGroupId | commercial_administration  | group           | core    | 0     | L:314  |
| L284       | merchant                 | skillId      | language                   | ordinary skill  | core    | 0     | L:314  |
| L285       | merchant                 | skillGroupId | transport_and_caravan_work | group           | favored | 0     | L:314  |
| L286       | merchant                 | skillId      | banking                    | ordinary skill  | favored | 0     | L:314  |
| L287       | merchant                 | skillId      | insight                    | ordinary skill  | favored | 0     | L:314  |
| L288       | messenger                | skillGroupId | mounted_service            | group           | core    | 0     | L:315  |
| L289       | messenger                | skillGroupId | transport_and_caravan_work | group           | core    | 0     | L:315  |
| L290       | messenger                | skillId      | language                   | ordinary skill  | core    | 0     | L:315  |
| L291       | messenger                | skillGroupId | route_security             | group           | favored | 0     | L:315  |
| L292       | messenger                | skillGroupId | athletic_conditioning      | group           | favored | 0     | L:315  |
| L293       | military_officer         | skillGroupId | basic_melee_training       | group           | core    | 0     | L:316  |
| L294       | military_officer         | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:316  |
| L295       | military_officer         | skillGroupId | veteran_leadership         | group           | core    | 0     | L:316  |
| L296       | military_officer         | skillId      | captaincy                  | ordinary skill  | core    | 0     | L:316  |
| L297       | military_officer         | skillId      | tactics                    | ordinary skill  | core    | 0     | L:316  |
| L298       | military_officer         | skillGroupId | civic_learning             | group           | favored | 0     | L:316  |
| L299       | military_officer         | skillId      | perception                 | ordinary skill  | favored | 0     | L:316  |
| L300       | military_officer         | skillId      | oratory                    | ordinary skill  | favored | 0     | L:316  |
| L301       | military_officer         | skillId      | administration             | ordinary skill  | favored | 0     | L:316  |
| L302       | military_officer         | skillId      | law                        | ordinary skill  | favored | 0     | L:316  |
| L303       | military_officer         | skillId      | combat_experience          | secondary skill | favored | 0     | L:316  |
| L304       | miner                    | skillGroupId | technical_measurement      | group           | core    | 0     | L:317  |
| L305       | miner                    | skillGroupId | mining_extraction          | group           | core    | 0     | L:317  |
| L306       | mourner                  | skillGroupId | performance_basics         | group           | core    | 0     | L:318  |
| L307       | mourner                  | skillGroupId | omen_and_ritual_practice   | group           | core    | 0     | L:318  |
| L308       | mourner                  | skillGroupId | temple_service             | group           | favored | 0     | L:318  |
| L309       | musician                 | skillGroupId | performance_basics         | group           | core    | 0     | L:319  |
| L310       | musician                 | skillId      | music                      | ordinary skill  | core    | 0     | L:319  |
| L311       | musician                 | skillId      | singing                    | ordinary skill  | core    | 0     | L:319  |
| L312       | musician                 | skillId      | dancing                    | ordinary skill  | favored | 0     | L:319  |
| L313       | musician                 | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:319  |
| L314       | musician                 | skillId      | storytelling               | ordinary skill  | favored | 0     | L:319  |
| L315       | noble                    | skillGroupId | courtly_formation          | group           | core    | 0     | L:320  |
| L316       | noble                    | skillId      | etiquette                  | ordinary skill  | core    | 0     | L:320  |
| L317       | noble                    | skillId      | heraldry                   | ordinary skill  | core    | 0     | L:320  |
| L318       | noble                    | skillGroupId | political_acumen           | group           | favored | 0     | L:320  |
| L319       | noble                    | skillId      | insight                    | ordinary skill  | favored | 0     | L:320  |
| L320       | noble                    | skillId      | courtly_protocol           | ordinary skill  | favored | 0     | L:320  |
| L321       | noble                    | skillId      | captaincy                  | ordinary skill  | favored | 0     | L:320  |
| L322       | noble                    | skillId      | law                        | ordinary skill  | favored | 0     | L:320  |
| L323       | outrider_scout           | skillGroupId | basic_missile_training     | group           | core    | 0     | L:321  |
| L324       | outrider_scout           | skillGroupId | mounted_service            | group           | favored | 0     | L:321  |
| L325       | outrider_scout           | skillGroupId | fieldcraft_stealth         | group           | favored | 0     | L:321  |
| L326       | peddler                  | skillGroupId | mercantile_practice        | group           | core    | 0     | L:322  |
| L327       | peddler                  | skillGroupId | transport_and_caravan_work | group           | core    | 0     | L:322  |
| L328       | peddler                  | skillId      | language                   | ordinary skill  | core    | 0     | L:322  |
| L329       | peddler                  | skillGroupId | mounted_service            | group           | favored | 0     | L:322  |
| L330       | peddler                  | skillGroupId | social_reading             | group           | favored | 0     | L:322  |
| L331       | peddler                  | skillId      | insight                    | ordinary skill  | favored | 0     | L:322  |
| L332       | personal_servant         | skillGroupId | courtly_formation          | group           | core    | 0     | L:323  |
| L333       | personal_servant         | skillId      | etiquette                  | ordinary skill  | core    | 0     | L:323  |
| L334       | personal_servant         | skillId      | insight                    | ordinary skill  | core    | 0     | L:323  |
| L335       | personal_servant         | skillId      | courtly_protocol           | ordinary skill  | favored | 0     | L:323  |
| L336       | personal_servant         | skillId      | social_perception          | secondary skill | favored | 0     | L:323  |
| L337       | philosopher              | skillGroupId | literate_foundation        | group           | core    | 0     | L:324  |
| L338       | philosopher              | skillGroupId | scholarly_formation        | group           | core    | 0     | L:324  |
| L339       | philosopher              | skillGroupId | mental_discipline          | group           | core    | 0     | L:324  |
| L340       | philosopher              | skillGroupId | civic_learning             | group           | favored | 0     | L:324  |
| L341       | philosopher              | skillGroupId | social_reading             | group           | favored | 0     | L:324  |
| L342       | pickpocket               | skillGroupId | street_theft               | group           | core    | 0     | L:325  |
| L343       | pickpocket               | skillId      | pickpocket                 | secondary skill | core    | 0     | L:325  |
| L344       | pickpocket               | skillId      | conceal_object             | secondary skill | core    | 0     | L:325  |
| L345       | pickpocket               | skillId      | stealth                    | ordinary skill  | favored | 0     | L:325  |
| L346       | pickpocket               | skillId      | insight                    | ordinary skill  | favored | 0     | L:325  |
| L347       | pickpocket               | skillId      | search                     | ordinary skill  | favored | 0     | L:325  |
| L348       | politician               | skillGroupId | courtly_formation          | group           | core    | 0     | L:326  |
| L349       | politician               | skillGroupId | political_acumen           | group           | core    | 0     | L:326  |
| L350       | politician               | skillId      | intrigue                   | ordinary skill  | core    | 0     | L:326  |
| L351       | politician               | skillId      | oratory                    | ordinary skill  | core    | 0     | L:326  |
| L352       | politician               | skillId      | insight                    | ordinary skill  | favored | 0     | L:326  |
| L353       | politician               | skillId      | law                        | ordinary skill  | favored | 0     | L:326  |
| L354       | politician               | skillId      | administration             | ordinary skill  | favored | 0     | L:326  |
| L355       | politician               | skillId      | detect_lies                | secondary skill | favored | 0     | L:326  |
| L356       | priest                   | skillGroupId | sacred_learning            | group           | core    | 0     | L:327  |
| L357       | priest                   | skillGroupId | omen_and_ritual_practice   | group           | core    | 0     | L:327  |
| L358       | priest                   | skillGroupId | temple_service             | group           | core    | 0     | L:327  |
| L359       | priest                   | skillGroupId | literate_foundation        | group           | favored | 0     | L:327  |
| L360       | priest                   | skillGroupId | civic_learning             | group           | favored | 0     | L:327  |
| L361       | priest                   | skillGroupId | healing_practice           | group           | favored | 0     | L:327  |
| L362       | prospector               | skillId      | search                     | ordinary skill  | core    | 0     | L:328  |
| L363       | prospector               | skillId      | perception                 | ordinary skill  | core    | 0     | L:328  |
| L364       | prospector               | skillId      | stoneworking               | ordinary skill  | favored | 0     | L:328  |
| L365       | prospector               | skillId      | teamstering                | ordinary skill  | favored | 0     | L:328  |
| L366       | prospector               | skillId      | run                        | ordinary skill  | favored | 0     | L:328  |
| L367       | prostitute               | skillGroupId | mercantile_practice        | group           | core    | 0     | L:329  |
| L368       | prostitute               | skillGroupId | social_reading             | group           | core    | 0     | L:329  |
| L369       | prostitute               | skillId      | seduction                  | secondary skill | core    | 0     | L:329  |
| L370       | prostitute               | skillGroupId | performance_basics         | group           | favored | 0     | L:329  |
| L371       | prostitute               | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:329  |
| L372       | prostitute_courtesan     | skillGroupId | social_reading             | group           | core    | 0     | L:330  |
| L373       | prostitute_courtesan     | skillGroupId | performance_basics         | group           | core    | 0     | L:330  |
| L374       | prostitute_courtesan     | skillId      | seduction                  | secondary skill | core    | 0     | L:330  |
| L375       | prostitute_courtesan     | skillGroupId | formal_performance         | group           | favored | 0     | L:330  |
| L376       | prostitute_courtesan     | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:330  |
| L377       | sailor                   | skillGroupId | maritime_crew_training     | group           | core    | 0     | L:331  |
| L378       | sailor                   | skillId      | sailing                    | ordinary skill  | core    | 0     | L:331  |
| L379       | sailor                   | skillId      | ropework                   | secondary skill | favored | 0     | L:331  |
| L380       | sailor                   | skillId      | boat_handling              | secondary skill | favored | 0     | L:331  |
| L381       | sailor                   | skillId      | swim                       | secondary skill | favored | 0     | L:331  |
| L382       | sailor                   | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:331  |
| L383       | scribe                   | skillGroupId | literate_foundation        | group           | core    | 0     | L:332  |
| L384       | scribe                   | skillGroupId | civic_learning             | group           | core    | 0     | L:332  |
| L385       | scribe                   | skillGroupId | commercial_administration  | group           | core    | 0     | L:332  |
| L386       | scribe                   | skillGroupId | scholarly_formation        | group           | favored | 0     | L:332  |
| L387       | shaman                   | skillGroupId | omen_and_ritual_practice   | group           | core    | 0     | L:333  |
| L388       | shaman                   | skillGroupId | healing_practice           | group           | core    | 0     | L:333  |
| L389       | shaman                   | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:333  |
| L390       | shaman                   | skillGroupId | mental_discipline          | group           | favored | 0     | L:333  |
| L391       | shaman                   | skillId      | insight                    | ordinary skill  | favored | 0     | L:333  |
| L392       | ships_officer            | skillGroupId | ship_command               | group           | core    | 0     | L:334  |
| L393       | slave_master             | skillId      | captaincy                  | ordinary skill  | core    | 0     | L:335  |
| L394       | slave_master             | skillId      | insight                    | ordinary skill  | core    | 0     | L:335  |
| L395       | slave_master             | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:335  |
| L396       | slave_master             | skillId      | detect_lies                | secondary skill | favored | 0     | L:335  |
| L397       | slave_master             | skillId      | administration             | ordinary skill  | favored | 0     | L:335  |
| L398       | smuggler                 | skillGroupId | smuggling_illicit_trade    | group           | core    | 0     | L:336  |
| L399       | smuggler                 | skillGroupId | covert_entry               | group           | favored | 0     | L:336  |
| L400       | smuggler                 | skillId      | language                   | ordinary skill  | favored | 0     | L:336  |
| L401       | soothsayer               | skillGroupId | omen_and_ritual_practice   | group           | core    | 0     | L:337  |
| L402       | soothsayer               | skillGroupId | healing_practice           | group           | core    | 0     | L:337  |
| L403       | soothsayer               | skillGroupId | herb_and_remedy_craft      | group           | core    | 0     | L:337  |
| L404       | soothsayer               | skillId      | astrology                  | ordinary skill  | core    | 0     | L:337  |
| L405       | soothsayer               | skillGroupId | mental_discipline          | group           | favored | 0     | L:337  |
| L406       | soothsayer               | skillGroupId | social_reading             | group           | favored | 0     | L:337  |
| L407       | spy                      | skillGroupId | covert_entry               | group           | core    | 0     | L:338  |
| L408       | spy                      | skillGroupId | political_acumen           | group           | core    | 0     | L:338  |
| L409       | spy                      | skillId      | disguise                   | secondary skill | core    | 0     | L:338  |
| L410       | spy                      | skillId      | intrigue                   | ordinary skill  | core    | 0     | L:338  |
| L411       | spy                      | skillId      | stealth                    | ordinary skill  | favored | 0     | L:338  |
| L412       | spy                      | skillId      | detect_lies                | secondary skill | favored | 0     | L:338  |
| L413       | spy                      | skillId      | etiquette                  | ordinary skill  | favored | 0     | L:338  |
| L414       | spy                      | skillId      | search                     | ordinary skill  | favored | 0     | L:338  |
| L415       | street_thug              | skillId      | brawling                   | secondary skill | core    | 0     | L:339  |
| L416       | street_thug              | skillId      | insight                    | ordinary skill  | core    | 0     | L:339  |
| L417       | street_thug              | skillId      | one_handed_concussion_axe  | secondary skill | favored | 0     | L:339  |
| L418       | street_thug              | skillId      | stealth                    | ordinary skill  | favored | 0     | L:339  |
| L419       | street_thug              | skillId      | bargaining                 | ordinary skill  | favored | 0     | L:339  |
| L420       | student                  | skillGroupId | literate_foundation        | group           | core    | 0     | L:340  |
| L421       | student                  | skillGroupId | civic_learning             | group           | core    | 0     | L:340  |
| L422       | student                  | skillGroupId | scholarly_formation        | group           | core    | 0     | L:340  |
| L423       | student                  | skillGroupId | mental_discipline          | group           | favored | 0     | L:340  |
| L424       | tax_collector            | skillGroupId | literate_foundation        | group           | core    | 0     | L:341  |
| L425       | tax_collector            | skillGroupId | civic_learning             | group           | core    | 0     | L:341  |
| L426       | tax_collector            | skillGroupId | commercial_administration  | group           | core    | 0     | L:341  |
| L427       | tax_collector            | skillGroupId | fiscal_administration      | group           | core    | 0     | L:341  |
| L428       | tax_collector            | skillGroupId | social_reading             | group           | favored | 0     | L:341  |
| L429       | tax_collector            | skillGroupId | courtly_formation          | group           | favored | 0     | L:341  |
| L430       | thief                    | skillGroupId | covert_entry               | group           | core    | 0     | L:342  |
| L431       | thief                    | skillGroupId | street_theft               | group           | core    | 0     | L:342  |
| L432       | thief                    | skillId      | stealth                    | ordinary skill  | core    | 0     | L:342  |
| L433       | thief                    | skillId      | search                     | ordinary skill  | core    | 0     | L:342  |
| L434       | thief                    | skillId      | lockpicking                | ordinary skill  | favored | 0     | L:342  |
| L435       | thief                    | skillId      | pickpocket                 | secondary skill | favored | 0     | L:342  |
| L436       | thief                    | skillId      | conceal_object             | secondary skill | favored | 0     | L:342  |
| L437       | thief                    | skillId      | hide                       | secondary skill | favored | 0     | L:342  |
| L438       | torturer                 | skillId      | insight                    | ordinary skill  | core    | 0     | L:343  |
| L439       | torturer                 | skillId      | detect_lies                | secondary skill | favored | 0     | L:343  |
| L440       | torturer                 | skillId      | medicine                   | ordinary skill  | favored | 0     | L:343  |
| L441       | torturer                 | skillId      | intrigue                   | ordinary skill  | favored | 0     | L:343  |
| L442       | watchman                 | skillGroupId | basic_melee_training       | group           | core    | 0     | L:344  |
| L443       | watchman                 | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:344  |
| L444       | watchman                 | skillGroupId | watch_civic_guard          | group           | favored | 0     | L:344  |
| L445       | woodcutter               | skillGroupId | technical_measurement      | group           | core    | 0     | L:345  |
| L446       | woodcutter               | skillGroupId | forestry_resource_work     | group           | core    | 0     | L:345  |
| L447       | village_guard            | skillGroupId | basic_melee_training       | group           | core    | 0     | L:346  |
| L448       | village_guard            | skillGroupId | watch_civic_guard          | group           | favored | 0     | L:346  |
| L449       | village_guard            | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:346  |
| L450       | militia_fighter          | skillGroupId | basic_melee_training       | group           | core    | 0     | L:347  |
| L451       | militia_fighter          | skillGroupId | basic_missile_training     | group           | core    | 0     | L:347  |
| L452       | militia_fighter          | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:347  |
| L453       | garrison_soldier         | skillGroupId | basic_melee_training       | group           | core    | 0     | L:348  |
| L454       | garrison_soldier         | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:348  |
| L455       | garrison_soldier         | skillGroupId | veteran_soldiering         | group           | favored | 0     | L:348  |
| L456       | veteran_sergeant         | skillGroupId | basic_melee_training       | group           | core    | 0     | L:349  |
| L457       | veteran_sergeant         | skillGroupId | basic_missile_training     | group           | core    | 0     | L:349  |
| L458       | veteran_sergeant         | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:349  |
| L459       | veteran_sergeant         | skillGroupId | veteran_soldiering         | group           | core    | 0     | L:349  |
| L460       | veteran_sergeant         | skillGroupId | veteran_leadership         | group           | favored | 0     | L:349  |
| L461       | city_watch_officer       | skillGroupId | basic_melee_training       | group           | core    | 0     | L:350  |
| L462       | city_watch_officer       | skillGroupId | watch_civic_guard          | group           | core    | 0     | L:350  |
| L463       | city_watch_officer       | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:350  |
| L464       | city_watch_officer       | skillGroupId | veteran_leadership         | group           | favored | 0     | L:350  |
| L465       | city_watch_officer       | skillGroupId | civic_learning             | group           | favored | 0     | L:350  |
| L466       | quartermaster            | skillGroupId | civic_learning             | group           | core    | 0     | L:351  |
| L467       | quartermaster            | skillGroupId | commercial_administration  | group           | core    | 0     | L:351  |
| L468       | quartermaster            | skillGroupId | literate_foundation        | group           | core    | 0     | L:351  |
| L469       | quartermaster            | skillGroupId | route_security             | group           | favored | 0     | L:351  |
| L470       | quartermaster            | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:351  |
| L471       | staff_officer            | skillGroupId | veteran_leadership         | group           | core    | 0     | L:352  |
| L472       | staff_officer            | skillGroupId | civic_learning             | group           | core    | 0     | L:352  |
| L473       | staff_officer            | skillGroupId | literate_foundation        | group           | core    | 0     | L:352  |
| L474       | staff_officer            | skillGroupId | veteran_soldiering         | group           | core    | 0     | L:352  |
| L475       | staff_officer            | skillGroupId | courtly_formation          | group           | favored | 0     | L:352  |
| L476       | staff_officer            | skillGroupId | commercial_administration  | group           | favored | 0     | L:352  |
| L477       | staff_officer            | skillGroupId | political_acumen           | group           | favored | 0     | L:352  |
| L478       | imperial_officer         | skillGroupId | basic_melee_training       | group           | core    | 0     | L:353  |
| L479       | imperial_officer         | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:353  |
| L480       | imperial_officer         | skillGroupId | veteran_soldiering         | group           | core    | 0     | L:353  |
| L481       | imperial_officer         | skillGroupId | veteran_leadership         | group           | core    | 0     | L:353  |
| L482       | imperial_officer         | skillGroupId | civic_learning             | group           | core    | 0     | L:353  |
| L483       | imperial_officer         | skillGroupId | literate_foundation        | group           | core    | 0     | L:353  |
| L484       | imperial_officer         | skillGroupId | courtly_formation          | group           | favored | 0     | L:353  |
| L485       | imperial_officer         | skillGroupId | political_acumen           | group           | favored | 0     | L:353  |
| L486       | cavalry_officer          | skillGroupId | mounted_warrior_training   | group           | core    | 0     | L:354  |
| L487       | cavalry_officer          | skillGroupId | veteran_soldiering         | group           | core    | 0     | L:354  |
| L488       | cavalry_officer          | skillGroupId | veteran_leadership         | group           | core    | 0     | L:354  |
| L489       | cavalry_officer          | skillGroupId | defensive_soldiering       | group           | favored | 0     | L:354  |
| L490       | cavalry_officer          | skillGroupId | civic_learning             | group           | favored | 0     | L:354  |
| L491       | cavalry_officer          | skillGroupId | courtly_formation          | group           | favored | 0     | L:354  |
| L492       | elite_guard_officer      | skillGroupId | watch_civic_guard          | group           | core    | 0     | L:355  |
| L493       | elite_guard_officer      | skillGroupId | basic_melee_training       | group           | core    | 0     | L:355  |
| L494       | elite_guard_officer      | skillGroupId | defensive_soldiering       | group           | core    | 0     | L:355  |
| L495       | elite_guard_officer      | skillGroupId | courtly_formation          | group           | core    | 0     | L:355  |
| L496       | elite_guard_officer      | skillGroupId | veteran_soldiering         | group           | favored | 0     | L:355  |
| L497       | elite_guard_officer      | skillGroupId | veteran_leadership         | group           | favored | 0     | L:355  |
| L498       | elite_guard_officer      | skillGroupId | political_acumen           | group           | favored | 0     | L:355  |
| L499       | guild_master             | skillGroupId | craft_group                | group           | core    | 0     | L:356  |
| L500       | guild_master             | skillGroupId | mercantile_practice        | group           | core    | 0     | L:356  |
| L501       | guild_master             | skillGroupId | commercial_administration  | group           | core    | 0     | L:356  |
| L502       | guild_master             | skillGroupId | civic_learning             | group           | favored | 0     | L:356  |
| L503       | guild_master             | skillGroupId | political_acumen           | group           | favored | 0     | L:356  |
| L504       | merchant_factor          | skillGroupId | mercantile_practice        | group           | core    | 0     | L:357  |
| L505       | merchant_factor          | skillGroupId | commercial_administration  | group           | core    | 0     | L:357  |
| L506       | merchant_factor          | skillGroupId | operations                 | group           | core    | 0     | L:357  |
| L507       | merchant_factor          | skillId      | language                   | ordinary skill  | core    | 0     | L:357  |
| L508       | merchant_factor          | skillId      | etiquette                  | ordinary skill  | core    | 0     | L:357  |
| L509       | merchant_factor          | skillGroupId | civic_learning             | group           | favored | 0     | L:357  |
| L510       | merchant_factor          | skillGroupId | political_acumen           | group           | favored | 0     | L:357  |
| L511       | merchant_factor          | skillGroupId | social_reading             | group           | favored | 0     | L:357  |
| L512       | banker_moneylender       | skillGroupId | commercial_administration  | group           | core    | 0     | L:358  |
| L513       | banker_moneylender       | skillGroupId | mercantile_practice        | group           | core    | 0     | L:358  |
| L514       | banker_moneylender       | skillGroupId | operations                 | group           | core    | 0     | L:358  |
| L515       | banker_moneylender       | skillGroupId | civic_learning             | group           | favored | 0     | L:358  |
| L516       | banker_moneylender       | skillGroupId | social_reading             | group           | favored | 0     | L:358  |
| L517       | great_merchant           | skillGroupId | mercantile_practice        | group           | core    | 0     | L:359  |
| L518       | great_merchant           | skillGroupId | commercial_administration  | group           | core    | 0     | L:359  |
| L519       | great_merchant           | skillGroupId | operations                 | group           | core    | 0     | L:359  |
| L520       | great_merchant           | skillGroupId | political_acumen           | group           | core    | 0     | L:359  |
| L521       | great_merchant           | skillId      | language                   | ordinary skill  | core    | 0     | L:359  |
| L522       | great_merchant           | skillGroupId | courtly_formation          | group           | favored | 0     | L:359  |
| L523       | great_merchant           | skillGroupId | civic_learning             | group           | favored | 0     | L:359  |
