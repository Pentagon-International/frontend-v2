import { useCallback, useEffect, useRef, useState } from "react";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import "./pdfjsSetup";

export function usePdfDocument(pdfBlobUrl: string | null) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!pdfBlobUrl) {
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      setPdfDoc(null);
      setNumPages(0);
      setIsLoading(false);
      return;
    }

    const loadId = ++loadIdRef.current;
    let cancelled = false;

    const load = async () => {
      // Keep the current page visible while replacing the blob after Save —
      // flipping isLoading would unmount the viewer and break fit-scale.
      const isFirstLoad = pdfDocRef.current == null;
      if (isFirstLoad) setIsLoading(true);
      setError(null);

      try {
        const loadingTask = getDocument(pdfBlobUrl);
        const doc = await loadingTask.promise;
        if (cancelled || loadId !== loadIdRef.current) {
          await doc.destroy();
          return;
        }

        const previous = pdfDocRef.current;
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        if (previous && previous !== doc) {
          void previous.destroy();
        }
      } catch (err) {
        if (!cancelled && loadId === loadIdRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
          if (pdfDocRef.current == null) {
            setPdfDoc(null);
            setNumPages(0);
          }
        }
      } finally {
        if (!cancelled && loadId === loadIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [pdfBlobUrl]);

  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, []);

  const reload = useCallback(() => {}, []);

  return { pdfDoc, numPages, isLoading, error, reload };
}
