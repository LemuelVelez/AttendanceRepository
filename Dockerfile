FROM node:22-alpine AS frontend
WORKDIR /app/view
COPY view/package.json ./
RUN npm install --no-audit --no-fund
COPY view/ ./
RUN npm run build

FROM golang:1.25-alpine AS backend
WORKDIR /src
RUN apk add --no-cache ca-certificates tzdata
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/view/dist ./view/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /attendance .

FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata && addgroup -S attendance && adduser -S attendance -G attendance
COPY --from=backend /attendance /app/attendance
COPY --from=backend /src/view/dist /app/view/dist
RUN chown -R attendance:attendance /app
USER attendance
EXPOSE 8080
CMD ["/app/attendance"]
