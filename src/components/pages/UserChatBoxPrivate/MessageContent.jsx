import React, { useState } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faCheck } from "@fortawesome/free-solid-svg-icons";

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Wrap every (case-insensitive) occurrence of `term` inside a string in <mark>.
const markString = (text, term) => {
  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() && part !== ""
      ? <mark key={i} className="chat-highlight">{part}</mark>
      : part
  );
};

// Recursively highlight `term` within React children, leaving elements
// (links, images, code…) untouched.
const highlightChildren = (children, term) => {
  if (!term) return children;
  return React.Children.map(children, (child) =>
    typeof child === "string" ? markString(child, term) : child
  );
};

const EMBED_RE = /(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+)/;
const SPOTIFY_RE = /(https?:\/\/open\.spotify\.com\/(?:track|album|playlist)\/[\w?=-]+)/;

// Wrap bare URLs in markdown link syntax so a plain pasted link becomes a
// clickable link / embed, while leaving URLs already inside markdown — like the
// `![name](url)` / `[📎 name](url)` snippets we insert for attachments — alone.
const autolink = (text) =>
  String(text || "").replace(
    /(^|[^\]("])(https?:\/\/[^\s)]+)/g,
    (_m, pre, url) => `${pre}[${url}](${url})`
  );

/**
 * Renders a chat message body as markdown: inline images, clickable links,
 * YouTube/Spotify embeds and code blocks. Mirrors the public ChatBox renderer
 * so private and public chat look identical.
 */
const MessageContent = ({ content, highlight }) => {
  const [copiedKey, setCopiedKey] = useState(null);

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

  const components = {
    p: ({ children }) => <p>{highlightChildren(children, highlight)}</p>,
    li: ({ children }) => <li>{highlightChildren(children, highlight)}</li>,
    a: ({ href, children }) => {
      if (href && EMBED_RE.test(href)) {
        return (
          <div className="embed-container">
            <iframe
              width="560"
              height="315"
              src={href.replace("watch?v=", "embed/")}
              frameBorder="0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="italic text-blue-600 block mt-1"
            >
              {href}
            </a>
          </div>
        );
      }
      if (href && SPOTIFY_RE.test(href)) {
        const spotifyEmbedUrl = href.replace(
          /(https:\/\/open\.spotify\.com\/)/,
          "https://open.spotify.com/embed/"
        );
        return (
          <div className="spotify-container">
            <iframe
              style={{ borderRadius: "12px" }}
              src={`${spotifyEmbedUrl}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="italic text-blue-600"
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt }) => (
      <div className="image-container">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }}
        />
      </div>
    ),
    code: ({ inline, children, ...props }) => {
      if (inline) {
        return (
          <code className="bg-gray-200 px-1 rounded text-red-600 font-mono" {...props}>
            {children}
          </code>
        );
      }
      const codeText = Array.isArray(children)
        ? children.join("")
        : String(children || "");
      const blockKey = `code-${codeText.slice(0, 24)}-${codeText.length}`;
      return (
        <div className="code-block-wrap">
          <button
            type="button"
            className="code-copy-btn"
            onClick={() => copy(codeText.replace(/\n$/, ""), blockKey)}
            title="Copy code"
          >
            <FontAwesomeIcon icon={copiedKey === blockKey ? faCheck : faCopy} />
            <span className="ml-1">{copiedKey === blockKey ? "Copied" : "Copy"}</span>
          </button>
          <pre className="bg-gray-800 text-white p-2 rounded-md overflow-x-auto my-2 text-sm">
            <code {...props}>{children}</code>
          </pre>
        </div>
      );
    },
  };

  return <ReactMarkdown components={components}>{autolink(content)}</ReactMarkdown>;
};

MessageContent.propTypes = {
  content: PropTypes.string,
  highlight: PropTypes.string,
};

export default MessageContent;
