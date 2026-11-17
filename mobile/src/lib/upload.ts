// Direct-to-storage upload through a presigned PUT URL, with progress and cancellation.
export function uploadWithProgress(uploadUrl: string, fileUri: string, contentType: string, onProgress?: (percent: number) => void) {
  const xhr = new XMLHttpRequest();

  const promise = (async () => {
    const blob = await (await fetch(fileUri)).blob();
    await new Promise<void>((resolve, reject) => {
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("File upload failed.")));
      xhr.onerror = () => reject(new Error("File upload failed."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(blob);
    });
  })();

  return { promise, cancel: () => xhr.abort() };
}
