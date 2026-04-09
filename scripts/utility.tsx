import DOMPurify from 'dompurify';

export function HTMLDecode({rawHTML}: {rawHTML: string}) {
    const sanitizedHTML = DOMPurify.sanitize(rawHTML);
    const createMarkup = () => {
        return { __html: sanitizedHTML };
    };

    return <div dangerouslySetInnerHTML={createMarkup()} />;
};

export function formattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

