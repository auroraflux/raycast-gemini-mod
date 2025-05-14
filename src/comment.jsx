import useGemini from "./api/gemini";
import { getPreferenceValues } from "@raycast/api";

export default function Comment(props) {
  const { prompt, model, showDiff, disableThinking } = getPreferenceValues();
  return useGemini(props, {
    context: prompt,
    model: model,
    allowPaste: true,
    useSelected: true,
    showDiff: showDiff,
    disableThinking: disableThinking
  });
}
