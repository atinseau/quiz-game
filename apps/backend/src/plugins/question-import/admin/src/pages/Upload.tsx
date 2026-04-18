import {
  Alert,
  Box,
  Button,
  Textarea,
  Typography,
} from "@strapi/design-system";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postPreview } from "../lib/api";
import { saveDraft } from "../lib/draftStore";

export default function Upload() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const body = JSON.parse(raw);
      const response = await postPreview(body);
      await saveDraft({
        previewId: response.previewId,
        createdAt: Date.now(),
        request: body,
        response,
      });
      navigate(`../review/${response.previewId}`);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box padding={8}>
      <Typography variant="alpha" tag="h1">
        Importer un pack de questions
      </Typography>
      <Box paddingTop={4} paddingBottom={4}>
        <Typography variant="omega" textColor="neutral600">
          Colle un JSON au format <code>{`{ pack, questions[] }`}</code>. Les
          doublons seront détectés avant l'enregistrement définitif.
        </Typography>
      </Box>
      {error && (
        <Box paddingBottom={4}>
          <Alert variant="danger" title="Erreur">
            {error}
          </Alert>
        </Box>
      )}
      <Textarea
        label="JSON"
        placeholder='{"pack":{...},"questions":[...]}'
        rows={16}
        value={raw}
        onChange={(e: any) => setRaw(e.target.value)}
      />
      <Box paddingTop={4}>
        <Button loading={busy} onClick={handleSubmit} disabled={!raw.trim()}>
          Analyser
        </Button>
      </Box>
    </Box>
  );
}
