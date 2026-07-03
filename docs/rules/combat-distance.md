# Combat Distance

Combat distance is shared pairwise encounter state.

- Each active participant pair has one unordered distance edge.
- Distance is an integer from `0` to `8`.
- Melee distances are `0` through `4`.
- A to B and B to A always resolve to the same edge.

Missing pair distances can be defaulted from weapon reach. The default is the longest preferred
distance across the active/wielded weapons of both participants. Current imported weapon data stores
this as weapon `range`; optional `preferredDistances` metadata is also supported. If no usable
weapon distance metadata is available, the app falls back to distance `2` and records a note.

The GM can set pair distance manually. A GM-set edge overrides the weapon default and is command
backed, so Clear restores the previous edge or removes the GM-set edge if no previous edge existed.

Using a weapon outside its preferred distance creates an OB/Skill penalty:

- penalty is `-2` per range step outside the nearest preferred distance
- preferred `[2]`, actual `4` gives `-4`
- preferred `[2]`, actual `1` gives `-2`
- preferred `[1, 2]`, actual `4` gives `-4`

Penalties are represented as generated combat modifier rows, not by mutating base OB. Full
coordinates, facing, pathing, movement conflict resolution, and automatic round-end distance
changes are future work.
