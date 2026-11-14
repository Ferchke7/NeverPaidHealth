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
            className="px-1.5 py-0.5 mx-0.5 rounded-[6px] bg-[#171717] text-[#34d399] font-mono text-[11px] sm:text-xs border border-[#262626] font-medium break-all inline-block"
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
          <ol key={`list-${keyPrefix}`} className="my-1.5 space-y-1">
            {currentListItems}
          </ol>
        );
      } else {
        renderedElements.push(
          <ul key={`list-${keyPrefix}`} className="my-1.5 space-y-1">
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
      renderedElements.push(<div key={`empty-${index}`} className="h-1" />);
      return;
    }

    // Markdown Headers (###, ##, #)
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      flushList(index);
      const headerText = line.replace(/^#+\s*/, '');
      renderedElements.push(
        <h4
          key={`header-${index}`}
          className="font-semibold text-xs sm:text-sm mt-2.5 mb-1 flex items-center gap-1.5 text-[#34d399] first:mt-0 tracking-tight"
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
          className="border-l-2 border-[#34d399] bg-[#022c22]/60 px-2.5 py-1.5 rounded-r-[8px] my-1.5 text-[#a3a3a3] text-xs sm:text-sm leading-snug"
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
        <li key={`num-item-${index}`} className="flex items-start gap-2 text-[#fafafa]">
          <span className="w-4 h-4 rounded-[4px] bg-[#171717] text-[#34d399] text-[10px] font-mono tabular-nums font-semibold flex items-center justify-center shrink-0 mt-0.5 border border-[#262626]">
            {num}
          </span>
          <div className="flex-1 leading-snug break-words">{parseInlineFormatting(text)}</div>
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
        <li key={`bullet-item-${index}`} className="flex items-start gap-2 text-[#fafafa]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] shrink-0 mt-1.5" />
          <div className="flex-1 leading-snug break-words">{parseInlineFormatting(text)}</div>
        </li>
      );
      return;
    }

    // Regular Paragraph Line
    flushList(index);
    renderedElements.push(
      <p key={`p-${index}`} className="leading-snug text-[#fafafa] my-0.5 break-words">
        {parseInlineFormatting(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-0.5 select-text text-xs sm:text-sm break-words leading-snug">{renderedElements}</div>;
};

