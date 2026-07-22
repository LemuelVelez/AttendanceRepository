package service

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
)

const passwordIterations = 120000

func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	digest := derivePassword([]byte(password), salt, passwordIterations)
	return fmt.Sprintf("sha256$%d$%s$%s", passwordIterations, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest)), nil
}

func CheckPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "sha256" {
		return false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations < 1 || iterations > 1000000 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	actual := derivePassword([]byte(password), salt, iterations)
	return len(actual) == len(expected) && subtle.ConstantTimeCompare(actual, expected) == 1
}

func derivePassword(password, salt []byte, iterations int) []byte {
	buffer := make([]byte, 0, len(salt)+len(password))
	buffer = append(buffer, salt...)
	buffer = append(buffer, password...)
	digest := sha256.Sum256(buffer)
	current := digest[:]
	for index := 1; index < iterations; index++ {
		nextInput := make([]byte, 0, len(current)+len(salt))
		nextInput = append(nextInput, current...)
		nextInput = append(nextInput, salt...)
		next := sha256.Sum256(nextInput)
		current = next[:]
	}
	return append([]byte(nil), current...)
}
