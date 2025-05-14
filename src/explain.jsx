import useGemini from "./api/gemini";
import { getPreferenceValues } from "@raycast/api";

export default function Explain(props) {
  const { prompt, model, showDiff, disableThinking } = getPreferenceValues();
  return useGemini(props, {
    context: prompt,
    model: model,
    useSelected: true,
    showDiff: showDiff,
    disableThinking: disableThinking
  });
}
