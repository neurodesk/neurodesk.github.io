---
title: "Interfacing"
linkTitle: "Interfacing"
weight: 5
description: >
  Section to describe programmatic interfaces to Neurodesk
---

# Connecting/attaching to a running Neurodesktop session via a plain shell
You can start a neurodesktop container using docker or the neurodeskapp. If you want to connect to this running session using a shell you can do this as well:
```
docker ps
# note the name of the running container, e.g. neurodeskapp-49977

# now connect to this container
docker exec --user=jovyan -ti neurodeskapp-49977 bash
```

# API interface to Jupyter
Install necessary tools, e.g. for macos
```
brew install coreutils
brew install websocat
```

Start a jupyter notebook session, e.g. on EXAMPLE_API_URL="play-europe.neurodesk.org"

Then open a terminal in jupyter and find your jupyterhub token and your username:
```
echo $JUPYTERHUB_USER
echo $JPY_API_TOKEN
```

Now you can interface with Jupyter through:
```
USER=$JUPYTERHUB_USER
USER_TOKEN=$JPY_API_TOKEN
API_URL=$EXAMPLE_API_URL

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
    
    local clean_api_url=${API_URL#*//}
    
    local output=""
    for attempt in {1..3}; do
        echo "  Attempt $attempt..."
        
        
        echo "$ $cmd"
        
        # Send command
        echo "[\"stdin\", \"$cmd\\r\\n\"]" | \
            websocat --text \
            "wss://$clean_api_url/user/$USER/terminals/websocket/$TERMINAL_NAME" \
            -H "Authorization: token $USER_TOKEN" >/dev/null 2>&1
        
        # Wait for command to complete
        sleep 5
        
        # get the terminal output
        local output=$(echo '["stdin", ""]' | \
            timeout 10 websocat --text \
            "wss://$clean_api_url/user/$USER/terminals/websocket/$TERMINAL_NAME" \
            -H "Authorization: token $USER_TOKEN" 2>/dev/null)
        
        if [ -n "$output" ]; then
            echo "$output" | \
            grep '^\["stdout"' | \
            sed 's/^\["stdout", *"//; s/"\]$//' | \
            sed 's/\\u001b\[[?]*[0-9;]*[a-zA-Z]//g; s/\\r\\n/\n/g; s/\\r/\n/g' | \
            sed -n "/\$ $command/,/\$ /p" | \
            sed '1d; $d' | \
            grep -v "^$"

            return 0
        fi
        
        echo "(no output)"
        
        sleep 2
    done
    
    echo "  ❌ Command failed after 3 attempts"
    echo "  Output: $output"
    return 1
}
send_command "touch test.txt"
send_command "ls"
send_command "ml fsl; fslmaths"


# To start an interactive terminal session
interactive_terminal() {

    local clean_api_url=${API_URL#*//}
    
    echo "=== Interactive Terminal Started ==="
    echo "Type 'exit' to quit"
    echo "=================================="
    
    while true; do
        echo -n "$ "
        read -r user_cmd
        
        # Exit condition
        if [[ "$user_cmd" == "exit" ]]; then
            echo "Terminal session ended."
            break
        fi
        
        # Skip empty commands
        if [[ -z "$user_cmd" ]]; then
            continue
        fi
        
        
        echo "Executing: $user_cmd"
        
        # Send command
        echo "[\"stdin\", \"$user_cmd\\r\\n\"]" | \
            websocat --text \
            "wss://$clean_api_url/user/$USER/terminals/websocket/$TERMINAL_NAME" \
            -H "Authorization: token $USER_TOKEN" >/dev/null 2>&1
        
        # Wait for execution
        sleep 5
        
        # Get output
        local output=$(echo '["stdin", ""]' | \
            timeout 10 websocat --text \
            "wss://$clean_api_url/user/$USER/terminals/websocket/$TERMINAL_NAME" \
            -H "Authorization: token $USER_TOKEN" 2>/dev/null)
        
        if [ -n "$output" ]; then
            echo "$output" | \
            grep '^\["stdout"' | \
            sed 's/^\["stdout", *"//; s/"\]$//' | \
            sed 's/\\u001b\[[?]*[0-9;]*[a-zA-Z]//g; s/\\r\\n/\n/g; s/\\r/\n/g' | \
            sed -n "/\$ $command/,/\$ /p" | \
            sed '1d; $d' | \
            grep -v "^$"

        else
            echo "(no output)"
        fi
        
        echo "" 
    done
}

interactive_terminal