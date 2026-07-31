import { renderMermaidASCII } from "beautiful-mermaid";

const graph = `
graph TD
  A[Start] --> B{Is it?};
`;

const result = renderMermaidASCII(graph, {});
console.log(typeof result, result instanceof Promise);
