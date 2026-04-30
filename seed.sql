CREATE TABLE ngrok_tunnels (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    public_url TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'active',
    region     VARCHAR(10),
    port       INTEGER,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);


CREATE TABLE ngrok_tunnels_tokens (
    ngrok_tunnels_id INTEGER REFERENCES ngrok_tunnels(id) ON DELETE CASCADE,
    ngrok_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW());

CREATE TABLE ngrok_tunnels_details (
    ngrok_tunnels_id INTEGER REFERENCES ngrok_tunnels(id) ON DELETE CASCADE,
    app_name VARCHAR(255) NOT NULL,
    app_port INTEGER NOT NULL,
    process_id INTEGER NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    isactive BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);