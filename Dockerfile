# Production image: builds the Rapfi WebAssembly engine, then serves the static game with nginx.
#   docker build -t rapfi-gomoku .
#   docker run -d -p 8080:80 rapfi-gomoku
# The engine/networks submodule must be checked out before building:
#   git submodule update --init engine/networks

# ---- Stage 1: engine -> WebAssembly ---------------------------------------------------------------
FROM emscripten/emsdk:3.1.64 AS engine
WORKDIR /src
COPY engine ./engine
COPY scripts/build-engine.sh ./scripts/build-engine.sh
RUN test -f engine/networks/wasm_preloads.txt \
      || (echo "engine/networks is empty: run 'git submodule update --init engine/networks'" >&2; exit 1)
RUN bash scripts/build-engine.sh

# ---- Stage 2: static site -------------------------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
COPY --from=engine /src/public/engine /usr/share/nginx/html/engine
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
EXPOSE 80
