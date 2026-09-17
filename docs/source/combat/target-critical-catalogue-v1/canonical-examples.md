# Target Critical catalogue V1 canonical examples

These examples are future implementation and QA fixture authority. They do not assert that current
runtime behavior already matches the target package.

## 1. Fixed one-round effect

`fire_energy|whole_body|06#c02` creates Stunned, General `-4`, for one complete subsequent round.
If created during Round 7, it remains active through the rest of Round 7 and all of Round 8. It
expires during the Round 8 Round End Effects slot before GM Review. The Round 7 boundary does not
consume the promised round.

## 2. Fixed two-round effect

`fire_energy|whole_body|09#c02` creates Dazed, General `-2`, for two complete subsequent rounds. If
created during Round 7, it remains active through Rounds 8 and 9 and expires during the Round 9 Round
End Effects slot.

## 3. Dazed plus Stunned

`fire_energy|whole_body|09#c02` and `#c03` are separate consequences from one wound:

- Dazed: General `-2` for two rounds;
- Stunned: General `-4` for two rounds.

The displayed aggregate is General `-6`. Removing either source leaves the other unchanged. The
wound's non-runtime burn/shock loss and persistent content do not merge into either modifier.

## 4. Two independent Stunned sources

Apply `fire_energy|whole_body|06#c02` and `sharp|head|07#c03` from two different wounds to one
character. Each is Stunned, General `-4`, with independent event/source identity. The aggregate is
General `-8` while both are active. Expiry of one leaves the other at General `-4`. Replaying the
exact same event/source does not create a third source; that is an idempotency defect.

## 5. Multiple Bleed sources

`sharp|arm|12#c06` creates external Bleed `1/2 HP/round`.
`sharp|chest|09#c04` creates internal Bleed `1/4 HP/round`.

Both first accrue only after one complete subsequent round. While both are active, the HP aggregate
is `3/4 HP/round`, using exact rational remainder. At the first full interval the remainder is `3/4`.
At the second full interval the accumulator reaches `1 1/2`, applies 1 HP, and carries `1/2`.
Staunching the arm source leaves the chest source at `1/4`; stabilising the chest source does not
alter the arm source.

## 6. Scheduled recovery

`sharp|chest|08#c03` is `cannot_recover_stance`. Its first Mobility check, difficulty 21, is due after
one complete subsequent round and repeats every round. Success allows stance recovery. Failure keeps
the condition and schedules the next check. Merely reaching the checkpoint never expires the state.

## 7. Bounded recovery

`sharp|head|09#c03` is unconscious. Its first Health check, difficulty 21, is due after two complete
subsequent rounds and repeats every two rounds, with at most three checks. Success ends
unconsciousness and applies Dazed for one round. Each failure preserves unconsciousness. After the
third failure, the condition changes to `persists until stabilised`; it does not continue an
arbitrarily long random-check tail.

## 8. Treatment-linked effect

`sharp|arm|12#c06` is an external Bleed source. Compression may move this source into controlled
state; staunching moves this source to zero continuing loss. Neither event removes
`sharp|arm|12#c02` Dazed, `#c03` Stunned, `#c07` hand function loss, or either persistent injury.
Treatment of a different wound has no effect on this source.

## 9. Critical-triggered CE

`fire_energy|whole_body|06#c05` schedules a fresh CE roll for the struck character in the next CE
pre-phase. Round End may show that schedule becoming due, but it does not perform the CE roll. The
current CE state and modifier persist until the scheduled roll resolves and replaces them.

## 10. Simultaneous Round End expiry and checks

Assume `fire_energy|whole_body|09#c02` and `#c03` were created in Round 7, while
`sharp|chest|08#c03` was created in Round 8. At the end of Round 9:

1. Dazed and Stunned from the Fire/Energy wound reach their fixed two-round expiry.
2. The chest wound's scheduled Mobility check is also due.
3. Round End Effects shows and resolves the three chronological events while the game is still in
   Round 9.
4. GM Review follows with the expiry and check outcome visible.
5. Only the GM's Start New Round action creates Round 10.

The Mobility condition persists if the check fails even though the named modifiers expire.

## 11. Severe result with persistent injury

`sharp|arm|12` is Severe and composes:

- minimum total damage 5 HP;
- Dazed `-2` and Stunned `-4`, each for two rounds;
- immediate fall and dropped held item;
- external Bleed `1/2 HP/round`;
- unusable hand until qualifying treatment or recovery; and
- structured persistent Dexterity/manual-skill injury content.

The persistent consequences are part of target severity and remain source-traceable, but #216 does
not activate a characteristic mutation, recovery model, database field, or migration.

## 12. Damage floor

For `sharp|arm|12#c01`, reviewed physical damage 2 and minimum total damage 5 produce one final
physical damage result of 5. They do not produce 7 and do not create a second Critical damage row.

## 13. Parry-only exception

`sharp|chest|04#c03` and `blunt|chest|04#c03` are the only `action_limited_to_parry` conditions.
Each is tied to concrete chest/stance trauma and a retained rolled duration. Neither implies
unconsciousness or authorizes use of `parry_only` elsewhere.

## 14. Fire/Energy conditional

`fire_energy|whole_body|06#c04` applies deafened for one round only when the actual cause is an
explosion or lightning. Ordinary flame exposure does not receive that consequence. The cause is
context inside the outcome, not a new catalogue axis.
