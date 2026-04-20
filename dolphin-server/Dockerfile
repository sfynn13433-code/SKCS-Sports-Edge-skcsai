# Dockerfile for Dolphin 3.0 Llama 3.2 3B Server on Render
FROM ghcr.io/ggml-org/llama.cpp:server

# Download the Dolphin model (Q4_K_M for faster inference, smaller size)
# Q4_K_M: ~1.9GB vs Q5_K_M: ~2.2GB - 15% smaller, ~20% faster
ADD https://huggingface.co/cognitivecomputations/Dolphin3.0-Llama3.2-3B-GGUF/resolve/main/Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf /models/model.gguf

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
