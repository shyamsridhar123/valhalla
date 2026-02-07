.PHONY: build dev test demo clean ui

GO := go
BINARY := bin/valhalla
UI_DIR := ui

build: ui-build
	$(GO) build -o $(BINARY) ./cmd/valhalla

dev:
	@echo "Starting dev mode..."
	@cd $(UI_DIR) && npm run dev &
	$(GO) run ./cmd/valhalla --demo

test:
	$(GO) test -race -count=1 ./...

demo: build
	./$(BINARY) --demo

ui-build:
	cd $(UI_DIR) && npm run build

ui-install:
	cd $(UI_DIR) && npm install

clean:
	rm -rf $(BINARY) $(UI_DIR)/dist
