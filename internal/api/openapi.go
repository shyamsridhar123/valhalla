package api

import "net/http"

// openapiSpec is the OpenAPI 3.0 specification for the Valhalla API.
const openapiSpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Valhalla PoC API",
    "description": "REST + WebSocket API for the Valhalla decentralized network proof-of-concept. All endpoints are served from the single Go binary.",
    "version": "0.1.0",
    "license": { "name": "MIT" }
  },
  "servers": [
    { "url": "http://localhost:8080", "description": "Local dev server" }
  ],
  "tags": [
    { "name": "Network",     "description": "Node / peer topology" },
    { "name": "Scenarios",   "description": "Pre-built demo scenarios" },
    { "name": "Content",     "description": "Content-addressed storage" },
    { "name": "Trust",       "description": "Attestations & reputation" },
    { "name": "Interactive", "description": "Sandbox actions (send message, CRDT, etc.)" },
    { "name": "System",      "description": "Health & events" }
  ],
  "paths": {
    "/api/health": {
      "get": {
        "tags": ["System"],
        "summary": "Health check",
        "description": "Returns current server status, node count, and timestamp.",
        "responses": {
          "200": {
            "description": "Server is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status":    { "type": "string", "example": "ok" },
                    "nodes":     { "type": "integer", "example": 6 },
                    "timestamp": { "type": "integer", "format": "int64", "example": 1738900000000 }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/nodes": {
      "get": {
        "tags": ["Network"],
        "summary": "List all nodes",
        "description": "Returns information for every node in the demo network.",
        "responses": {
          "200": {
            "description": "Array of node info objects",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/NodeInfo" }
                }
              }
            }
          }
        }
      }
    },
    "/api/nodes/{index}": {
      "get": {
        "tags": ["Network"],
        "summary": "Get node by index",
        "description": "Returns detailed information for a single node.",
        "parameters": [
          {
            "name": "index",
            "in": "path",
            "required": true,
            "schema": { "type": "integer" },
            "description": "Zero-based node index"
          }
        ],
        "responses": {
          "200": {
            "description": "Node info",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/NodeInfo" }
              }
            }
          },
          "400": { "description": "Invalid index" },
          "404": { "description": "Node not found" }
        }
      }
    },
    "/api/peers": {
      "get": {
        "tags": ["Network"],
        "summary": "List peer connections",
        "description": "Returns every directed peer link in the network.",
        "responses": {
          "200": {
            "description": "Array of peer links",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/PeerLink" }
                }
              }
            }
          }
        }
      }
    },
    "/api/scenarios": {
      "get": {
        "tags": ["Scenarios"],
        "summary": "List available scenarios",
        "description": "Returns the name and description of every demo scenario.",
        "responses": {
          "200": {
            "description": "Array of scenarios",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/ScenarioInfo" }
                }
              }
            }
          }
        }
      }
    },
    "/api/scenarios/run": {
      "post": {
        "tags": ["Scenarios"],
        "summary": "Run a scenario",
        "description": "Starts a named scenario in the background. Narration events are streamed over the WebSocket.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string", "example": "content-publish" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Scenario started",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status":   { "type": "string", "example": "running" },
                    "scenario": { "type": "string" }
                  }
                }
              }
            }
          },
          "404": { "description": "Scenario not found" }
        }
      }
    },
    "/api/content": {
      "get": {
        "tags": ["Content"],
        "summary": "List published content",
        "description": "Aggregates content metadata across all node caches.",
        "responses": {
          "200": {
            "description": "Array of content items",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/ContentInfo" }
                }
              }
            }
          }
        }
      }
    },
    "/api/trust": {
      "get": {
        "tags": ["Trust"],
        "summary": "List attestations",
        "description": "Returns all trust attestations aggregated from every node.",
        "responses": {
          "200": {
            "description": "Array of trust attestations",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/TrustInfo" }
                }
              }
            }
          }
        }
      }
    },
    "/api/events": {
      "get": {
        "tags": ["System"],
        "summary": "WebSocket event stream",
        "description": "Upgrades to a WebSocket connection. The server pushes StackEvent JSON objects for every layer event across all nodes.",
        "responses": {
          "101": { "description": "Switching to WebSocket protocol" }
        }
      }
    },
    "/api/interactive/message": {
      "post": {
        "tags": ["Interactive"],
        "summary": "Send a message between nodes",
        "description": "Sends an RPC chat message from one node to another via the Veil encrypted channel.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["src", "dst", "message"],
                "properties": {
                  "src":     { "type": "integer", "description": "Source node index" },
                  "dst":     { "type": "integer", "description": "Destination node index" },
                  "message": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Message delivered",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": { "type": "string", "example": "delivered" },
                    "from":   { "type": "string" },
                    "to":     { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/interactive/trust": {
      "post": {
        "tags": ["Interactive"],
        "summary": "Create a trust attestation",
        "description": "Creates a trust attestation from one node about another and syncs it to both trust stores.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["src", "dst", "claim", "confidence"],
                "properties": {
                  "src":        { "type": "integer" },
                  "dst":        { "type": "integer" },
                  "claim":      { "type": "string", "example": "reliable-peer" },
                  "confidence": { "type": "number", "format": "float", "minimum": 0, "maximum": 1, "example": 0.85 }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Attestation created",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status":     { "type": "string", "example": "created" },
                    "attester":   { "type": "string" },
                    "subject":    { "type": "string" },
                    "confidence": { "type": "number" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/interactive/content": {
      "post": {
        "tags": ["Interactive"],
        "summary": "Publish content",
        "description": "Publishes content-addressed data from a node.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["node", "data"],
                "properties": {
                  "node":  { "type": "integer" },
                  "data":  { "type": "string" },
                  "title": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Content published",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status":    { "type": "string", "example": "published" },
                    "cid":       { "type": "string" },
                    "publisher": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/interactive/crdt": {
      "post": {
        "tags": ["Interactive"],
        "summary": "Set a CRDT key",
        "description": "Sets a key in the node's LWW-Register CRDT store and syncs to all peers.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["node", "key", "value"],
                "properties": {
                  "node":  { "type": "integer" },
                  "key":   { "type": "string" },
                  "value": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Key set and synced",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status":       { "type": "string", "example": "set" },
                    "key":          { "type": "string" },
                    "value":        { "type": "string" },
                    "synced_peers": { "type": "integer" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/interactive/state/{index}": {
      "get": {
        "tags": ["Interactive"],
        "summary": "Get full node state",
        "description": "Returns complete state for a node including peers, CRDT store, trust store, and cache size.",
        "parameters": [
          {
            "name": "index",
            "in": "path",
            "required": true,
            "schema": { "type": "integer" }
          }
        ],
        "responses": {
          "200": { "description": "Full node state object" },
          "404": { "description": "Node not found" }
        }
      }
    },
    "/api/interactive/disconnect": {
      "post": {
        "tags": ["Interactive"],
        "summary": "Disconnect two nodes",
        "description": "Removes the bidirectional peer connection between two nodes.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["nodeA", "nodeB"],
                "properties": {
                  "nodeA": { "type": "integer" },
                  "nodeB": { "type": "integer" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Nodes disconnected",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": { "type": "string", "example": "disconnected" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/interactive/connect": {
      "post": {
        "tags": ["Interactive"],
        "summary": "Connect two nodes",
        "description": "Re-establishes the bidirectional peer connection between two nodes.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["nodeA", "nodeB"],
                "properties": {
                  "nodeA": { "type": "integer" },
                  "nodeB": { "type": "integer" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Nodes connected",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": { "type": "string", "example": "connected" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "NodeInfo": {
        "type": "object",
        "properties": {
          "short_id":  { "type": "string", "example": "VHHPw8d2Rsde" },
          "node_id":   { "type": "string" },
          "address":   { "type": "string", "example": "127.0.0.1:9000" },
          "port":      { "type": "integer", "example": 9000 },
          "peers":     { "type": "integer", "example": 5 },
          "services":  { "type": "array", "items": { "type": "string" } }
        }
      },
      "PeerLink": {
        "type": "object",
        "properties": {
          "from": { "type": "string" },
          "to":   { "type": "string" }
        }
      },
      "ScenarioInfo": {
        "type": "object",
        "properties": {
          "name":        { "type": "string" },
          "description": { "type": "string" }
        }
      },
      "ContentInfo": {
        "type": "object",
        "properties": {
          "cid":       { "type": "string" },
          "size":      { "type": "integer" },
          "publisher": { "type": "string" }
        }
      },
      "TrustInfo": {
        "type": "object",
        "properties": {
          "attester":   { "type": "string" },
          "subject":    { "type": "string" },
          "claim":      { "type": "string" },
          "confidence": { "type": "number" }
        }
      },
      "StackEvent": {
        "type": "object",
        "description": "Emitted over the WebSocket for every layer event.",
        "properties": {
          "id":        { "type": "string", "format": "uuid" },
          "layer":     { "type": "string", "enum": ["bifrost", "yggdrasil", "veil", "saga", "rune", "realm", "demo"] },
          "kind":      { "type": "string" },
          "node_id":   { "type": "string" },
          "detail":    { "type": "object", "additionalProperties": { "type": "string" } },
          "timestamp": { "type": "integer", "format": "int64" }
        }
      }
    }
  }
}`

func (s *Server) handleOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write([]byte(openapiSpec))
}
