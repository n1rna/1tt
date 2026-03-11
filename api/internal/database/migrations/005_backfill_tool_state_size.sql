-- +goose Up
UPDATE tool_state SET size = octet_length(data::text)::bigint WHERE size = 0;

-- +goose Down
-- no-op: size column remains
