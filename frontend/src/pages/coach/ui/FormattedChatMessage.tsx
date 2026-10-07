import React from 'react';

interface FormattedChatMessageProps {
  content: string;
}

export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({ content }) => {
  const parseInlineFormatting = (text: string): React.ReactNode[] => {
    // Matches **bold**, `code`, or regular text
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong key={idx} className="text-white font-semibold">
            {inner}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const inner = part.slice(1, -1);
        return (
          <span
            key={idx}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-dark-750 text-brand-300 font-mono text-[11px] sm:text-xs border border-dark-700 font-medium break-all inline-block"
          >
            {inner}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let isOrderedList = false;

  const flushList = (keyPrefix: number) => {
    if (currentListItems.length > 0) {
      if (isOrderedList) {
        renderedElements.push(
          <ol key={`list-${keyPrefix}`} className="my-2 space-y-1.5">
            {currentListItems}
          </ol>
        );
      } else {
        renderedElements.push(
          <ul key={`list-${keyPrefix}`} className="my-2 space-y-1.5">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
    }
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(index);
      renderedElements.push(<div key={`empty-${index}`} className="h-1.5" />);
      return;
    }

    // Markdown Headers (###, ##, #)
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      flushList(index);
      const headerText = line.replace(/^#+\s*/, '');
      renderedElements.push(
        <h4
          key={`header-${index}`}
          className="font-bold text-white text-xs sm:text-sm mt-3 mb-1.5 flex items-center gap-1.5 text-brand-400 first:mt-0 tracking-tight"
        >
          {parseInlineFormatting(headerText)}
        </h4>
      );
      return;
    }

    // Blockquote (> Note)
    if (line.startsWith('> ')) {
      flushList(index);
      const quoteText = line.slice(2);
      renderedElements.push(
        <div
          key={`quote-${index}`}
          className="border-l-2 border-brand-500 bg-brand-500/10 px-3 py-1.5 rounded-r-xl my-2 text-zinc-300 text-xs sm:text-sm leading-relaxed"
        >
          {parseInlineFormatting(quoteText)}
        </div>
      );
      return;
    }

    // Numbered List (1. , 2. )
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!isOrderedList && currentListItems.length > 0) {
        flushList(index);
      }
      isOrderedList = true;
      const num = numberedMatch[1];
      const text = numberedMatch[2];
      currentListItems.push(
        <li key={`num-item-${index}`} className="flex items-start gap-2 text-zinc-200">
          <span className="w-5 h-5 rounded-md bg-dark-750 text-brand-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 border border-dark-700 shadow-sm">
            {num}
          </span>
          <div className="flex-1 leading-relaxed break-words">{parseInlineFormatting(text)}</div>
        </li>
      );
      return;
    }

    // Bullet List (- , * , • )
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      if (isOrderedList && currentListItems.length > 0) {
        flushList(index);
      }
      isOrderedList = false;
      const text = line.replace(/^[-*•]\s+/, '');
      currentListItems.push(
        <li key={`bullet-item-${index}`} className="flex items-start gap-2 text-zinc-200">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0 mt-2 ring-2 ring-brand-500/30" />
          <div className="flex-1 leading-relaxed break-words">{parseInlineFormatting(text)}</div>
        </li>
      );
      return;
    }

    // Regular Paragraph Line
    flushList(index);
    renderedElements.push(
      <p key={`p-${index}`} className="leading-relaxed text-zinc-200 my-0.5 break-words">
        {parseInlineFormatting(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-0.5 select-text text-xs sm:text-sm break-words leading-relaxed">{renderedElements}</div>;
};
