
SHELL := /bin/bash
KEYBOARDD  := $(HOME)/development/PJOS-LINUX/runtime/keyboardd
KEYBOARD   := $(HOME)/development/pjos-keyboard
BIN        := $(CURDIR)/.work/keyboardd

.PHONY: all test test-keyboardd test-keyboard test-integration build fmt clean

all: test

# everything verifiable on this machine (no display server, no handheld)
test: test-keyboardd test-keyboard test-integration

build: $(BIN)

$(BIN):
	@mkdir -p $(CURDIR)/.work
	cd $(KEYBOARDD) && go build -o $(BIN) ./cmd/keyboardd

# Go unit + HTTP API tests (stub provider, in-memory store)
test-keyboardd:
	cd $(KEYBOARDD) && go vet ./... && go test ./...

# provider unit tests, typecheck, app + library builds
test-keyboard:
	cd $(KEYBOARD) && npm run typecheck && npm test && npm run build && npm run build:lib

# real keyboardd binary + pjos-keyboard client over HTTP
test-integration: $(BIN)
	cd $(CURDIR) && node tests/integration-input-api.mjs $(BIN)

fmt:
	cd $(KEYBOARDD) && gofmt -l .

clean:
	rm -rf $(CURDIR)/.work
