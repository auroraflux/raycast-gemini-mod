import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getPreferenceValues,
  getSelectedText,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  showToast,
  Toast,
} from "@raycast/api";
import fs from "fs";
import Gemini from "gemini-ai";
import fetch from "node-fetch";
import { useEffect, useState } from "react";
import { useCommandHistory } from "./useCommandHistory";
import * as Diff from 'diff';

export default (props, { context = undefined, allowPaste = false, useSelected = false, buffer = [], showDiff = false, disableThinking = false }) => {
  const Pages = {
    Form: 0,
    Detail: 1,
  };
  let { query: argQuery } = props.arguments;
  if (!argQuery) argQuery = props.fallbackText ?? "";

  // Global preferences like apiKey are still needed.
  // Model preference is now handled by the calling command and passed if necessary,
  // or this hook uses the global defaultModel if the command doesn't specify one.
  const globalPreferences = getPreferenceValues();
  const { apiKey, model: globalDefaultModelSetting, customModel: globalCustomModelSetting } = globalPreferences;

  // Determine the actual model to use: command's model > global customModel > global defaultModel
  // Note: The 'model' variable used in getResponse will be the one from command preferences,
  // which itself can be "default" to then trigger this logic.
  const isGlobalCustomModelValid = Boolean(globalCustomModelSetting && globalCustomModelSetting.trim().length > 0);
  const defaultModelToUse = isGlobalCustomModelValid ? globalCustomModelSetting : globalDefaultModelSetting;


  const [page, setPage] = useState(Pages.Detail);
  const [markdown, setMarkdown] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedState, setSelected] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [textarea, setTextarea] = useState("");
  const { addToHistory } = useCommandHistory();

  const getResponse = async (query, data, originalTextForDiff = null) => {
    setLastQuery(query);
    setPage(Pages.Detail);

    await showToast({
      style: Toast.Style.Animated,
      title: "Waiting for Gemini...",
    });

    const start = Date.now();
    const gemini = new Gemini(apiKey, { fetch });
  
    try {
      // The 'model' prop here comes from the command's preferences, passed through useGemini's options.
      // If the command's model preference is "default", then use defaultModelToUse.
      const currentModel = props.model === "default" || !props.model ? defaultModelToUse : props.model;

      const geminiOptions = {
        model: currentModel,
        stream: (x) => {
          try {
            if (x !== undefined && x !== null) {
              setMarkdown((markdown) => markdown + x);
            }
          } catch (streamError) {
            console.error("Error in stream callback:", streamError);
            showToast({
              style: Toast.Style.Failure,
              title: "Response Failed",
              message: streamError.message, // Display the error message in the toast notification
            });
          }
        },
        data: data ?? buffer,
      };
  
      if (disableThinking && currentModel === "gemini-2.5-flash-preview-04-17") {
        geminiOptions.generationConfig = {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        };
      }

      let response = await gemini.ask(query, geminiOptions);
      setLastResponse(response);

      if (showDiff && originalTextForDiff && typeof originalTextForDiff === 'string' && typeof response === 'string') {
        const differences = Diff.diffWordsWithSpace(originalTextForDiff, response);
        let diffMarkdown = "";
        differences.forEach((part, index) => {
          const trimmedValue = part.value.trim();

          if (part.added && trimmedValue !== '') {
            let prefix = "";
            // Check if the previous part exists, was 'removed', and was styled (had content)
            if (index > 0 && differences[index - 1].removed && differences[index - 1].value.trim() !== '') {
              // Add a space if the current markdown doesn't already end with one,
              // and the current added part's value doesn't start with one.
              if (!diffMarkdown.endsWith(' ') && !part.value.startsWith(' ')) {
                prefix = " ";
              }
            }
            diffMarkdown += prefix + `**${part.value}**`;
          } else if (part.removed && trimmedValue !== '') {
            diffMarkdown += `~~*${part.value}*~~`;
          } else {
            // Common part or whitespace-only part from diff
            diffMarkdown += part.value;
          }
        });
        setMarkdown(diffMarkdown);
      } else {
        setMarkdown(response); // Fallback to original behavior if no diff
      }

      // Add to history with model information
      const usedModel = currentModel; // Use the resolved currentModel
      await addToHistory(query, response, usedModel);

      await showToast({
        style: Toast.Style.Success,
        title: "Response Finished",
        message: `${(Date.now() - start) / 1000} seconds`,
      });
    } catch (e) {
      if (e.message.includes("429")) {
        await showToast({
          style: Toast.Style.Failure,
          title: "You have been rate-limited.",
          message: "Please slow down.",
        });
        setMarkdown("## Could not access Gemini.\n\nYou have been rate limited. Please slow down and try again later.");
      } else if (e.message.includes("The model is overloaded")) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Model Overloaded",
          message: "The model is currently overloaded. Please try again later.",
        });
        setMarkdown("## Could not access Gemini.\n\nThe model is currently overloaded. Please try again later.");
      } else {
        console.error(e);
        await showToast({
          style: Toast.Style.Failure,
          title: "Response Failed",
          // message: `${(Date.now() - start) / 1000} seconds`,
          message: e.message, // Display the error message in the toast notification
        });
        setMarkdown(
          "## Could not access Gemini.\n\nThis may be because Gemini has decided that your prompt did not comply with its regulations. Please try another prompt, and if it still does not work, create an issue on GitHub."
        );
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (useSelected) {
        try {
          let selected = await getSelectedText();
          if (argQuery === "") {
            setSelected(selected);
            setPage(Pages.Form);
          } else {
            getResponse(`${context}\n${argQuery}\n${selected}`, undefined, selected);
            return;
          }
          getResponse(`${context}\n${selected}`, undefined, selected);
        } catch (e) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Could not get the selected text. Continue without it.",
          });
          getResponse(argQuery, undefined, null); // Pass null for originalTextForDiff if selected text fails
        }
      } else {
        if (argQuery === "") {
          setPage(Pages.Form);
        } else {
          getResponse(argQuery, undefined, null); // Pass null for originalTextForDiff if not using selected
        }
      }
    })();
  }, []);

  return page === Pages.Detail ? (
    <Detail
      actions={
        !isLoading && (
          <ActionPanel>
            {allowPaste && <Action.Paste content={markdown} />}
            <Action.CopyToClipboard shortcut={Keyboard.Shortcut.Common.Copy} content={markdown} />
            {lastQuery && lastResponse && (
              <Action
                title="Continue in Chat"
                icon={Icon.Message}
                shortcut={{ modifiers: ["cmd"], key: "j" }}
                onAction={async () => {
                  await launchCommand({
                    name: "aiChat",
                    type: LaunchType.UserInitiated,
                    context: { query: lastQuery, response: lastResponse, creationName: "" },
                  });
                }}
              />
            )}
            <Action
              title="View History"
              icon={Icon.Clock}
              shortcut={{ modifiers: ["cmd"], key: "h" }}
              onAction={async () => {
                await launchCommand({
                  name: "history",
                  type: LaunchType.UserInitiated,
                });
              }}
            />
          </ActionPanel>
        )
      }
      isLoading={isLoading}
      markdown={markdown}
    />
  ) : (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            onSubmit={(values) => {
              setMarkdown("");

              let files = undefined;
              if (values.files) {
                files = values.files
                  .filter((file) => fs.existsSync(file) && fs.lstatSync(file).isFile())
                  .map((file) => fs.readFileSync(file));
              }

              if (useSelected) {
                getResponse(`${values.query}\n${selectedState}`, files, selectedState);
                return;
              }
              getResponse(`${context ? `${context}\n\n` : ""}${values.query}`, files, null); // Pass null for originalTextForDiff
            }}
          />
          <Action
            icon={Icon.Clipboard}
            title="Append Selected Text"
            onAction={async () => {
              try {
                const selectedText = await getSelectedText();
                setTextarea((text) => text + selectedText);
              } catch (error) {
                await showToast({
                  title: "Could not get the selected text",
                  style: Toast.Style.Failure,
                });
              }
            }}
            shortcut={{ modifiers: ["ctrl", "shift"], key: "v" }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        title="Prompt"
        id="query"
        value={textarea}
        onChange={(value) => setTextarea(value)}
        placeholder="Ask Gemini a question..."
      />
      {!buffer.length && (
        <>
          <Form.Description title="Image" text="Image that you want Gemini to analyze along with your prompt." />
          <Form.FilePicker id="files" title="" allowMultipleSelection={false} />
          <Form.Description text="Note that image data will not be carried over if you continue in Chat." />
        </>
      )}
    </Form>
  );
};
