# Dockerfile for Dolphin 3.0 Llama 3.2 3B Server on Render
FROM ghcr.io/ggml-org/llama.cpp:server

# Download the Dolphin model (Q5_K_M for good balance of quality/speed)
# This will be cached by Render's build layer
ADD https://huggingface.co/cognitivecomputations/Dolphin3.0-Llama3.2-3B-GGUF/resolve/main/Dolphin3.0-Llama3.2-3B-Q5_K_M.gguf /models/model.gguf

# Expose the server port
EXPOSE 8080

# Run the llama.cpp server
ENTRYPOINT ["/server"]
CMD [
    "-m", "/models/model.gguf",
    "--host", "0.0.0.0",
    "--port", "8080",
    "-c", "4096",
    "-n", "512",
    "--temp", "0.7",
    "-t", "4",
    "--parallel", "4",
    "--ctx-size", "4096",
    "--batch-size", "512"
]
