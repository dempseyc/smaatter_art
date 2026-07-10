# Smatter Art – Phase 1

> Smatter Art is an experimental generative art laboratory. The long-term goal is to evolve paintings through graph rewriting and geometric relaxation. Phase 1 is not concerned with final artwork. It is a development environment for graph generation and visualization.

## Goals

- Generate connected planar graphs procedurally.
- Display the graph interactively.
- Support graph rewriting in future phases.
- Export the current graph as SVG.
- Separate graph topology from Euclidean layout.

## Tech Stack

- React
- TypeScript
- SVG rendering
- Vite
- No canvas. SVG only.

## Data Model

Node { id, x, y, edges[] }

Edge { id, a, b }

Coordinates are only the current embedding of the graph and may be recomputed at any time.

## Architecture

Graph → Layout Engine → SVG Renderer

The graph owns topology only.
The layout engine computes $(x, y)$.
The renderer knows nothing about graph algorithms.

## Phase 1 Features

- Generate a connected graph.
- Produce a planar embedding.
- Display nodes and edges.
- Randomize graph.
- Re-run layout.
- Export SVG.

## Future (not yet)

- Parent/child genealogy
- Node generations
- Graph rewrite rules
- Proposal solver
- Euclidean constraints
- Canvas composition fields
- Morphogenesis

Design the project around interchangeable layout engines. The graph data model must never depend on a particular layout algorithm. A layout engine accepts a graph and returns node positions.

## Layout Menu

Layout
- Force Directed
- Radial
- Hierarchical
- Circular
- Tree

Integrate a mature graph layout library for development mode.
