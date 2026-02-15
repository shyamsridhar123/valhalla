.PHONY: build dev test demo clean ui bench lint

GO := go
BINARY := bin/valhalla
UI_DIR := ui
EMBED_DIR := cmd/valhalla/ui-dist

build: ui-build
	mkdir -p $(EMBED_DIR)
	cp -r $(UI_DIR)/dist/* $(EMBED_DIR)/
	$(GO) build -o $(BINARY) ./cmd/valhalla

dev:
	@echo "Starting dev mode..."
	@cd $(UI_DIR) && npm run dev &
	$(GO) run ./cmd/valhalla --demo

test:
	$(GO) test -race -count=1 ./...

bench:
	$(GO) test -bench=. -benchmem ./internal/types/ ./internal/bifrost/

lint:
	$(GO) vet ./...

demo: build
	./$(BINARY) --demo

ui-build:
	cd $(UI_DIR) && npm run build

ui-install:
	cd $(UI_DIR) && npm install

clean:
	rm -rf $(BINARY) $(UI_DIR)/dist $(EMBED_DIR)
