# Title
Test Adventure World

# Description
A test world for unit testing

# Background
This is a test background story that describes the setting

# First Action
You find yourself in a mysterious place.

# Objective
Explore and survive the challenges ahead

# Main Instructions
```
These are test instructions for the AI
Follow the rules carefully
```

# Author Style
```
Concise and descriptive
Show don't tell
```

# NSFW
false

# Content Warnings
None

# Description Request
```
Write in first person
Include sensory details
```

# Summary Request
Brief summaries of events

# Image Model
manticore

# Image Style
photo_beautiful

# Image Style Character Pre
A portrait of

# Image Style Character Post
in high quality

# Image Style Non Character Pre
A scene of

# Image Style Non Character Post
beautifully rendered

# Victory Condition
Reach the end

# Victory Text
You have won!

# Defeat Condition
Get defeated

# Defeat Text
You have lost.

# Design Notes
Test notes for design and implementation

# Player Permissions
Can Change Name: true
Can Change Description: true
Can Change Skills: true
Can Select Other Portraits: false
Can Create New Portrait: true
Can Change Tracked Items Starting Values: false

# Enable AI Specific Instruction Blocks
true

# Skills
- Combat
- Persuasion
- Stealth

# Possible Characters
## Test Character
### Description
A test character for the adventure
### Portrait
https://example.com/portrait.jpg
### Skills
- Combat: 3
- Persuasion: 2
- Stealth: 1

# Other Characters
## Test NPC
### Brief Summary
A mysterious stranger
### Character Detail
Full character details and backstory
### Appearance
Tall and mysterious with piercing eyes
### Location
The tavern near the market
### Secret Information
Has a secret past they hide
### Full List of Names
Mysterious One, The Stranger, Shadow Walker
### Image Appearance
Dark robes and mysterious aura
### Image Clothing
Black and mysterious attire

# Extra Instruction Blocks
## Combat Rules
### Content
Combat resolution system details and mechanics

# Keyword Instruction Blocks
## Ancient History
### Keywords
history, ancient, world
### Content
The world was once a different place with ancient civilizations

# Tracked Items
## Health Points
### Data Type
number
### Visibility
everyone
### Description
Your current health status
### Update Instructions
Decrease when damaged, increase when healed

# Trigger Events
## Victory Trigger
### Conditions
Type: triggerOnEvent
Data: Player reaches the goal
### Effects
Type: scriptedText
Data: You have reached victory!
