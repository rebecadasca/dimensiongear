# DimensionGear

## Development setup

1. Copy `Backend/.env.example` to `Backend/.env` and provide a MongoDB replica-set/Atlas URI, JWT secret, Google client ID and Stripe test keys.
2. Copy `Frontend/.env.example` to `Frontend/.env` and provide the matching Google and Stripe public keys.
3. Apply the MongoDB scripts in order:
   - `Backend/database/01_create_schema.mongodb.js`
   - `Backend/database/02_seed_catalog.mongodb.js`
   - `Backend/database/03_seed_customization.mongodb.js`
4. Install dependencies once with `npm run install:all`.
5. Start both applications from the repository root with `npm run dev`.

Frontend: `http://localhost:5173`  
API: `http://localhost:4000/api/v1`  
Health check: `http://localhost:4000/api/v1/health`

Google and Stripe controls stay unavailable until their development keys are configured. Stripe webhooks must forward to `http://localhost:4000/api/v1/stripe/webhook`.
