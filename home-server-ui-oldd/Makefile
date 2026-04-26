.PHONY: ui-build ui-dev clean

# Build React UI and copy to Flask static folder
ui-build:
	bun run build
	rm -rf build
	mkdir -p build
	cp -r dist/* build/

# Run development server
ui-dev:
	bun run dev

# Clean build artifacts
clean:
	rm -rf dist build

install:
	bun install
