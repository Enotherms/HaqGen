import { ButtonItem, ConfirmModal, PanelSectionRow, showModal } from "@decky/ui";
import { toaster } from "@decky/api";
import { useState } from "react";
import { removalPreview, removeAll, RemovalPreview } from "../api";
import { describeError } from "../logic";

function PreviewModal({
  preview,
  onOK,
  closeModal,
}: {
  preview: RemovalPreview;
  onOK: () => void;
  closeModal?: () => void;
}) {
  const nothing = preview.delete.length === 0 && preview.profiles.length === 0;
  return (
    <ConfirmModal
      strTitle="Remove HaqGen data"
      strOKButtonText={nothing ? "Close" : "Remove"}
      onOK={nothing ? () => closeModal?.() : onOK}
      onCancel={() => closeModal?.()}
      closeModal={closeModal}
    >
      <div style={{ fontSize: 13, wordBreak: "break-all" }}>
        {nothing && <p>Nothing to remove.</p>}
        {preview.delete.length > 0 && (
          <>
            <p>These files and folders will be deleted:</p>
            <ul>
              {preview.delete.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}
        {preview.profiles.length > 0 && (
          <>
            <p>These lsfg-vk profiles will be removed from your config:</p>
            <ul>
              {preview.profiles.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}
        {preview.refused.length > 0 && (
          <p>{preview.refused.length} item(s) will be skipped because they are outside HaqGen's folders.</p>
        )}
        <p>
          Drivers, system files, your games and Lossless Scaling are not touched. Launch options
          you set in Steam are not changed, so clear them yourself.
        </p>
      </div>
    </ConfirmModal>
  );
}

export function RemoveData({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const preview = await removalPreview();
      showModal(
        <PreviewModal
          preview={preview}
          onOK={async () => {
            const r = await removeAll(true);
            toaster.toast({
              title: "HaqGen",
              body: r.ok ? "Plugin data removed." : describeError(r.error),
            });
            onDone();
          }}
        />
      );
    } catch (e) {
      toaster.toast({ title: "HaqGen", body: describeError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelSectionRow>
      <ButtonItem layout="below" disabled={busy} onClick={start}>
        Remove plugin data
      </ButtonItem>
    </PanelSectionRow>
  );
}
