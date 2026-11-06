// Downloads stay in the browser; generated reports and references are never uploaded.
export function download(name: string, content: string | Blob, type = 'application/json') {
    const url = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type }) : content);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
