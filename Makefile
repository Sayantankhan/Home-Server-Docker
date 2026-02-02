run:
	sudo /project/home-server/venv/bin/python server.py

run-bg:
	nohup sudo /project/home-server/venv/bin/python server.py > server.log 2>&1 & echo $$! > server.pid

stop:
	@if [ -f server.pid ]; then \
		echo "Stopping server with PID $$(cat server.pid)"; \
		kill $$(cat server.pid) && rm -f server.pid; \
	else \
		echo "No server.pid file found. Server might not be running."; \
	fi
