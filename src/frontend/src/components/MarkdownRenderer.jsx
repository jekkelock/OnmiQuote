import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function MarkdownRenderer({ content }) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}