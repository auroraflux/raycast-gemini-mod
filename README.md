# Raycast Google Gemini

Use the powerful new Google Gemini Pro models from the comfort of Raycast.

**This is a modified version of the extension that does the following:**

I wanted to extend the Gemini extension to do something that other apps have been doing for a while, which is to show a visual differential between current text and new text, particularly for things like spellcheck. In the process, I also wanted to add the ability to disable thinking when using models like 2.5 Flash so that you get all the benefits of 2.5 Flash, but you don't burn through tokens unnecessarily when you're just trying to do things like spellcheck. I had AI assist me with creating these changes, and I've tested them pretty rigorously myself. 

**Feature: Enhanced Text Modification Commands with Visual Diff & Thinking Control**

**1. What this feature does:**

This enhancement introduces two new optional features for commands that modify selected text:

*   **Visual Diff:** Users can enable a "Show Visual Diff" option for relevant commands. When active, the command's output will display a Markdown-formatted difference between the original selected text and Gemini's modified version. Deletions are shown as ~~*strikethrough and italic*~~, and additions as **bold**. This helps users quickly see the exact changes made. To be clear, this is just eye candy. It has no functional purpose and **it is set to off by default** to not interrupt anybody's workflow.

![Image](https://github.com/user-attachments/assets/ef832b84-0c1c-47e7-a000-488e5fc93a20)

*   **Disable Model Thinking:** A "Disable Model Thinking" option is available for these commands. When checked, and if the "Gemini 2.5 Flash Preview" model is active for that command, it attempts to set the model's `thinkingBudget` to 0. This can potentially reduce latency or token usage for simpler tasks but might affect response quality for complex prompts. **This is also set to off by default.**

**2. Affected Commands:**

These new preferences ("Show Visual Diff" and "Disable Model Thinking") have been added (again, **off by default, just happens to be on in my screenshot**) to the following commands that operate on selected text:

*   Ask About Selected Text
*   Summarize
*   Explain
*   Add Comments to Code
*   Change Tone to Friendly
*   Change Tone to Professional
*   Find Synonym
*   Fix Spelling and Grammar (Visual Diff is ON by default for this command)
*   Make Longer
*   Make Shorter
*   Translate

![Image](https://github.com/user-attachments/assets/b5013207-0c52-4ca1-8dad-9cc907da1ef1)

**3. Technical Implementation Overview:**

To implement this, the following general changes were made:

*   **Command-Specific Preferences:** The `showDiff` and `disableThinking` settings were moved from global extension preferences to become individual preferences for each of the affected commands within [`package.json`](package.json:0). This allows per-command configuration.
*   **`useGemini` Hook Modification:** The central `useGemini` hook in [`src/api/gemini.jsx`](src/api/gemini.jsx:0) was updated. It now accepts `showDiff` and `disableThinking` boolean parameters directly from the options passed by each calling command, instead of relying on global settings.
*   **Individual Command Updates:** Each relevant command component (e.g., [`src/grammar.jsx`](src/grammar.jsx:0), [`src/summarize.jsx`](src/summarize.jsx:0)) was modified to:
    1.  Use `getPreferenceValues()` to retrieve its own specific `showDiff` and `disableThinking` settings.
    2.  Pass these settings when invoking the `useGemini` hook.
*   **Diff Generation:** The `diff` library is used to compare the original and modified text. The `useGemini` hook then formats these differences into a Markdown string using `~~*deleted*~~` and `**added**` styling if the `showDiff` option is active for the command.
*   **Conditional Thinking Budget:** The `useGemini` hook conditionally adds a `generationConfig: { thinkingConfig: { thinkingBudget: 0 } }` to the Gemini API call options if the command's `disableThinking` preference is true AND the active model for the command is `"gemini-2.5-flash-preview-04-17"`.





## Getting an API Key

1. Go to [Google Makersuite](https://makersuite.google.com/)
2. Click on Get API Key at the top left and follow steps to copy your key
3. Input your key on the Extension's setup page

You're all good to go!
