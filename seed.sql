CREATE TABLE ngrok_tunnels (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    public_url TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'active',
    region     VARCHAR(10),
    port       INTEGER,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);