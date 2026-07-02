import { useCallback, useEffect, useRef, useState } from "react";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import "./pdfjsSetup";

export function usePdfDocument(pdfBlobUrl: string | null) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    if (!pdfBlobUrl) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    const loadId = ++loadIdRef.current;
    let cancelled = false;
    let activeDoc: PDFDocumentProxy | null = null;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadingTask = getDocument(pdfBlobUrl);
        const doc = await loadingTask.promise;
        if (cancelled || loadId !== loadIdRef.current) {
          await doc.destroy();
          return;
        }
        activeDoc = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        if (!cancelled && loadId === loadIdRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
          setPdfDoc(null);
          setNumPages(0);
        }
      } finally {
        if (!cancelled && loadId === loadIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (activeDoc) {
        activeDoc.destroy();
      }
    };
  }, [pdfBlobUrl]);

  const reload = useCallback(() => {}, []);

  return { pdfDoc, numPages, isLoading, error, reload };
}
