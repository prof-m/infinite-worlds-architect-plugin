# Field Guide: Victory and Defeat

Fields: `victoryCondition`, `victoryText`, `defeatCondition`, `defeatText`

---

## CRITICAL: The AI Cannot See These Conditions During Play

"The storyteller AI does not receive these triggers with any special context, and therefore is not influenced by their contents in any way while writing outputs."

Victory and defeat conditions are evaluated by the **platform's game engine**, not by the storyteller AI. The AI writes narrative without any awareness of these fields. This means:
- Writing "when the player defeats the villain" in `victoryCondition` does NOT make the AI work toward or narrate a villain defeat
- The conditions only end the game when the engine's evaluation determines they're met
- The AI will not steer the story toward victory or away from defeat based on these fields

**For AI narrative guidance**, use `objective` (always-on goal) and `effectTellAIWhatToDo` trigger effects instead.

---

## victoryCondition (`victoryCondition`)
**Free-text string. Evaluated by the game engine each turn.**

The condition under which the player wins. Victory ends the game but allows the player to continue playing or restart.

**Default condition (when field is left empty):** "The player character has succeeded in their initial goals"

**Default victory text:** "Congratulations! You have been successful in your adventure." (contextualised to the original prompt when auto-generated)

**Authoring realities:**
- Many world authors disable victory conditions entirely because the defaults trigger too aggressively or at unintended moments
- When you need a victory condition, use very explicit language — the platform's evaluation can be unreliable with vague conditions
- Common technique: use ALL CAPS for emphasis and multiple restatements. Example: "ONLY trigger victory if the player has EXPLICITLY and COMPLETELY achieved X. Do not trigger for partial success. Do not trigger for implied success."
- For precise victory control, disable this field and use `endsGame` trigger effects instead — triggers give you full control over when the game ends

---

## defeatCondition (`defeatCondition`)
**Free-text string. Evaluated by the game engine each turn.**

The condition under which the player loses. Defeat terminates gameplay with no continuation option (restart only — unlike victory which allows continuation).

**Default condition:** "The player character has died"

**Default defeat text:** "Your adventure ends here. Game over."

**Authoring realities:**
- Same evaluation reliability issues as victory — many authors disable defeat too
- Death conditions in particular fire unpredictably if the story has any dark narrative content
- For precise defeat control, disable this field and use `endsGame` trigger effects instead

---

## victoryText / defeatText
**User-facing strings. Displayed when the game ends.**

The message shown to the player when the corresponding end condition is met. Can be left as defaults or customised to fit the world's tone. Variable replacement syntax (`<<item_name>>`) works in these fields if you want to reference tracked item values in the end message.

---

## Practical Guidance

**When to use these fields:** Simple worlds with a clear, easily-stated win/lose condition where you're comfortable with the engine's interpretation. Example: "The player has escaped the island" / "The player has been captured".

**When to disable and use triggers instead:** Complex worlds, worlds where you need precise control over timing, worlds where the default conditions fire incorrectly. Use `canTriggerMoreThanOnce: false` + `endsGame` effect in a trigger event with `triggerOnTrackedItem` or `triggerOnEvent` conditions.

**The `canContinueEndedGame` flag:** When using `endsGame` in a trigger effect, set `canContinueEndedGame: true` on the world root to allow players to continue playing after a victory-style ending.
