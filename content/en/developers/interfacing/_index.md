---
title: "Interfacing"
linkTitle: "Interfacing"
weight: 5
description: >
  Section to describe programmatic interfaces to Neurodesk
---

# Connecting/attaching to a running Neurodesktop session via a plain shell
You can start a neurodesktop container using docker or the neurodeskapp. If you want to connect to this running session using a plain shell you can do this as well:
```
docker ps
# note the name of the running container, e.g. neurodeskapp-49977

# now connect to this container
docker exec --user=jovyan -ti neurodeskapp-49977 bash
```

JUPYTERHUB_USER=stebo85
JPY_API_TOKEN=4a2d3b12b9a04e19921e1ee38fae7995

# API interface to Jupyter
Install necessary tools, e.g. for macos
```
brew install coreutils
brew install websocat
```

Start a jupyter notebook session.

Then open a terminal in jupyter and find your jupyterhub token and your username:
```
echo $JUPYTERHUB_USER
echo $JPY_API_TOKEN
```

Now you can interface with Jupyter through:
```
USER=$JUPYTERHUB_USER
USER_TOKEN=$JPY_API_TOKEN
API_URL="play-europe.neurodesk.org"
NAMESPACE="jupyter"

TERMINAL_RESPONSE=$(curl -k -s -X POST \
    -H "Authorization: token $USER_TOKEN" \
    "https://$API_URL/user/$USER/api/terminals" || echo '{"error": "curl_failed"}')

echo "Terminal API response: $TERMINAL_RESPONSE"

TERMINAL_NAME=$(echo "$TERMINAL_RESPONSE" | jq -r '.name // empty')

if [ -n "$TERMINAL_NAME" ] && [ "$TERMINAL_NAME" != "null" ] && [ "$TERMINAL_NAME" != "empty" ]; then
    echo "✅ Terminal created successfully: $TERMINAL_NAME"
else
    echo "❌ Terminal creation failed"
    echo "Full response: $TERMINAL_RESPONSE"
    
    # more info about the user
    echo "Checking user info..."
    USER_INFO=$(curl -k -s -H "Authorization: token $USER_TOKEN" "https://$API_URL/hub/api/users/$USER" || echo '{"error": "failed"}')
    echo "User info: $USER_INFO"
    exit 1
fi

# Function to test WebSocket connection
test_websocket_connection() {
    local token="$1"
    
    echo "Testing WebSocket connection..."
    
    # Test connection
    WS_TEST=$(echo '["stdin", "echo test_connection\r\n"]' | \
        timeout 15 websocat --text "ws://$API_URL/user/$USER/terminals/websocket/$TERMINAL_NAME" \
        -H "Authorization: token $token" 2>&1 | head -10)
    
    if [ $? -eq 0 ] && [ -n "$WS_TEST" ]; then
        echo "WebSocket response: $WS_TEST"
        
        # Check if we got expected output format
        if echo "$WS_TEST" | grep -q '\["stdout"'; then
            echo "✅ WebSocket connection successful with proper output format"
            return 0
        elif echo "$WS_TEST" | grep -q 'test_connection'; then
            echo "✅ WebSocket connection successful"
            return 0
        else
            echo "⚠️ WebSocket connected but unexpected format"
            echo "Raw output: $WS_TEST"
            return 1
        fi
    else
        echo "❌ WebSocket connection failed"
        echo "Error: $WS_TEST"
        return 1
    fi
}

# Test with user token
if test_websocket_connection "$USER_TOKEN"; then
    echo "✅ WebSocket connection working with user token"
else
    echo "❌ WebSocket connection failed"
    echo ""
    echo "🔍 Additional debugging info:"
    echo "- Terminal exists: $TERMINAL_NAME"
    echo "- User token: ${USER_TOKEN}..."
    echo "- API accessible: $(curl -k -s -o /dev/null -w "%{http_code}" "$API_URL")"
    echo "- WebSocket URL: ws://$API_URL/user/$USER/terminals/websocket/$TERMINAL_NAME"
fi


# Function to send command and get response
send_command() {
    local cmd="$1"
    
    echo "Testing command: $cmd"
    
    local output=""
    for attempt in {1..3}; do
        echo "  Attempt $attempt..."
        
        output=$(echo "[\"stdin\", \"$cmd\\r\\n\"]" | \
            gtimeout 10 websocat --text \
            "wss://$API_URL/user/$USER/terminals/websocket/$TERMINAL_NAME" \
            -H "Authorization: token $USER_TOKEN" 2>/dev/null | \
            grep '^\["stdout"' | \
            sed 's/^\["stdout", *"//; s/"\]$//; s/\\r\\n/\n/g; s/\\n/\n/g' | \
            tr -d '\000-\037' || echo "")
        
        if [ -n "$output" ]; then
            echo "  Got output: $output"
            return 0
        fi
        
        echo "  No output, retrying..."
        sleep 2
    done
    
    echo "  ❌ Command failed after 3 attempts"
    echo "  Output: $output"
    return 1
}
send_command "touch test.txt"
send_command "ml fsl; fslmaths"
```

