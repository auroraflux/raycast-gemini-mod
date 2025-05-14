# Plan: Visual Diff for Grammar Check Command

**Goal:** Modify the "Grammar Check" command to visually display differences between the user's selected text and Gemini's corrected output using Markdown styling (strikethrough for deletions, bold for additions).

**Date:** 2025-05-14

## I. Project Setup

1.  **Add `diff` Library:**
    *   Install the `diff` library as a project dependency. This library will be used to compare the original and corrected text.
    *   Command: `npm install diff` (or `yarn add diff`)

## II. Modify `src/api/gemini.jsx` (the `useGemini` hook)

1.  **Import `diff` Library:**
    At the top of the file, add:
    ```javascript
    import * as Diff from 'diff';
    ```

2.  **Update Hook Signature:**
    Modify the `useGemini` hook's signature to accept a new `showDiff` option (defaulting to `false`):
    ```javascript
    // From:
    // export default (props, { context = undefined, allowPaste = false, useSelected = false, buffer = [] }) => {
    // To:
    export default (props, { context = undefined, allowPaste = false, useSelected = false, buffer = [], showDiff = false }) => {
    ```

3.  **Pass Original Text to `getResponse`:**
    The `getResponse` function will need the original selected text to perform the diff.
    *   Modify its signature:
        ```javascript
        // From:
        // const getResponse = async (query, data) => {
        // To:
        const getResponse = async (query, data, originalTextForDiff = null) => {
        ```
    *   Update calls to `getResponse` within the `useEffect` hook (src/api/gemini.jsx) when `useSelected` is true, passing the `selected` text as the `originalTextForDiff` argument:
        ```javascript
        // Example for one of the calls:
        // From:
        // getResponse(`${context}\n${selected}`);
        // To:
        getResponse(`${context}\n${selected}`, undefined, selected);
        ```
        *(Ensure all relevant calls to `getResponse` within the `useSelected` block are updated similarly).*
    *   Update the call to `getResponse` in the `Form`'s `onSubmit` handler (src/api/gemini.jsx) when `useSelected` is true:
        ```javascript
        // From:
        // getResponse(`${values.query}\n${selectedState}`, files);
        // To:
        getResponse(`${values.query}\n${selectedState}`, files, selectedState);
        ```

4.  **Implement Diffing and Markdown Formatting in `getResponse`:**
    Inside the `getResponse` function, after successfully receiving the `response` from Gemini, add the diffing logic:
    ```javascript
    // const gemini = new Gemini(apiKey, { fetch }); // Existing code
    // try {
    //   let response = await gemini.ask(...); // Existing code
    //   // setMarkdown(response); // OLD LINE TO BE REPLACED/MODIFIED
    //   setLastResponse(response); // Existing line, keep it to store raw response

    if (showDiff && originalTextForDiff && typeof originalTextForDiff === 'string' && typeof response === 'string') {
      const differences = Diff.diffWordsWithSpace(originalTextForDiff, response);
      let diffMarkdown = "";
      differences.forEach(part => {
        if (part.added) {
          diffMarkdown += `**${part.value}**`; // Bold for additions
        } else if (part.removed) {
          diffMarkdown += `~~${part.value}~~`; // Strikethrough for deletions
        } else {
          diffMarkdown += part.value; // Common text
        }
      });
      setMarkdown(diffMarkdown);
    } else {
      setMarkdown(response); // Fallback to original behavior if no diff
    }
    //   await addToHistory(...); // Existing code
    // } catch (e) { ... } // Existing code
    ```
    *Note: The `setLastResponse(response)` should still receive the raw Gemini output for other functionalities like "Continue in Chat".*

## III. Modify `src/grammar.jsx`

1.  **Enable Diffing for Grammar Command:**
    In `src/grammar.jsx`, update the call to `useGemini` to pass the new `showDiff: true` option:
    ```javascript
    // From:
    // return useGemini(props, {
    //   context: prompt,
    //   allowPaste: true,
    //   useSelected: true,
    // });
    // To:
    return useGemini(props, {
      context: prompt,
      allowPaste: true,
      useSelected: true,
      showDiff: true, // Enable the diffing behavior
    });
    ```

## IV. Visual Flow (Mermaid Diagram)

```mermaid
sequenceDiagram
    participant User
    participant GrammarCmd (src/grammar.jsx)
    participant UseGeminiHook (src/api/gemini.jsx)
    participant RaycastAPI
    participant GeminiAPI
    participant DiffLibrary

    User->>GrammarCmd: Activates "Grammar Check" (selects text)
    GrammarCmd->>UseGeminiHook: Calls useGemini(props, {..., useSelected: true, showDiff: true})
    UseGeminiHook->>RaycastAPI: getSelectedText()
    RaycastAPI-->>UseGeminiHook: originalText
    UseGeminiHook->>UseGeminiHook: (Internally) Prepares prompt for Gemini
    UseGeminiHook->>GeminiAPI: getResponse(promptWithOriginal, data, originalText)
    GeminiAPI-->>UseGeminiHook: correctedText
    alt showDiff is true AND originalText available
        UseGeminiHook->>DiffLibrary: diffWordsWithSpace(originalText, correctedText)
        DiffLibrary-->>UseGeminiHook: differencesArray
        UseGeminiHook->>UseGeminiHook: Formats differencesArray into diffMarkdown (~~del~~ **add**)
        UseGeminiHook->>UseGeminiHook: setMarkdown(diffMarkdown)
    else
        UseGeminiHook->>UseGeminiHook: setMarkdown(correctedText)
    end
    UseGeminiHook->>RaycastAPI: Renders <Detail markdown={finalMarkdownToShow} />
    RaycastAPI->>User: Displays text with visual diff