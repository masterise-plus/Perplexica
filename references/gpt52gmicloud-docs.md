OpenAI GPT-5.2
API Usage
API Examples
Create chat completion
Default
Streaming
Image Input
Functions
Python
Create a model response
Default (Responses)
Streaming (Responses)
Reasoning
Functions (Responses)
Image Input (Responses)
File Input
Web search
GPT-5.2 is the latest frontier-grade model in the GPT-5 series, offering stronger agentic and long context perfomance compared to GPT-5.1. It uses adaptive reasoning to allocate computation dynamically, responding quickly to simple queries while spending more depth on complex tasks.
Built for broad task coverage, GPT-5.2 delivers consistent gains across math, coding, sciende, and tool calling workloads, with more coherent long-form answers and improved tool-use reliability.
API Usage
You can interact with the OpenAI GPT-5.2 model through various programming languages and methods. Below are examples showing how to use the model's API.
API Examples
Generate a model response using the chat endpoint of OpenAI GPT-5.2.
Create chat completion
The Chat Completions API endpoint will generate a model response from a list of messages comprising a conversation.
Default
sh

curl https://api.gmi-serving.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "messages": [
      {
        "role": "developer",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Hello!"
      }
    ]
  }'
sh

from openai import OpenAI

endpoint = "https://api.gmi-serving.com/v1/"
model_name = "openai/gpt-5.2"

api_key = "<gmi-api-key>"

client = OpenAI(
    base_url=f"{endpoint}",
    api_key=api_key
)

completion = client.chat.completions.create(
    model=model_name,
    messages=[
        {
            "role": "user",
            "content": "What is the capital of France?",
        }
    ],
)

print(completion.choices[0].message)
Streaming
sh

curl https://api.gmi-serving.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "messages": [
      {
        "role": "developer",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Hello!"
      }
    ],
    "stream": true
  }'
sh

from openai import OpenAI

endpoint = "https://api.gmi-serving.com/v1/"
model_name = "openai/gpt-5.2"

api_key = "<gmi-api-key>"

client = OpenAI(
    base_url=f"{endpoint}",
    api_key=api_key
)

completion = client.chat.completions.create(
  model=model_name,
  messages=[
    {"role": "developer", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  stream=True
)

for chunk in completion:
  print(chunk.choices[0].delta)

Image Input
sh

curl https://api.gmi-serving.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What is in this image?"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg"
            }
          }
        ]
      }
    ],
    "max_completion_tokens": 300
  }'
sh

from openai import OpenAI

endpoint = "https://api.gmi-serving.com/v1/"
model_name = "openai/gpt-5.2"

api_key = "<gmi-api-key>"

client = OpenAI(
    base_url=f"{endpoint}",
    api_key=api_key
)

completion = client.chat.completions.create(
    model=model_name,
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What's in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg",
                    }
                },
            ],
        }
    ],
    max_completion_tokens=300,
)

print(response.choices[0])

Functions
sh

curl https://api.gmi-serving.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "messages": [
      {
        "role": "user",
        "content": "What is the weather like in Boston today?"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_current_weather",
          "description": "Get the current weather in a given location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
              },
              "unit": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"]
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
sh

from openai import OpenAI

endpoint = "https://api.gmi-serving.com/v1/"
model_name = "openai/gpt-5.2"

api_key = "<gmi-api-key>"

client = OpenAI(
    base_url=f"{endpoint}",
    api_key=api_key
)

tools = [
  {
    "type": "function",
    "function": {
      "name": "get_current_weather",
      "description": "Get the current weather in a given location",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "The city and state, e.g. San Francisco, CA",
          },
          "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
        },
        "required": ["location"],
      },
    }
  }
]
messages = [{"role": "user", "content": "What's the weather like in Boston today?"}]
completion = client.chat.completions.create(
  model=model_name,
  messages=messages,
  tools=tools,
  tool_choice="auto"
)

print(completion)
Python
sh

import requests
import json

url = "https://api.gmi-serving.com/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer *************"
}

payload = {
    "model": "openai/gpt-5.2",
    "messages": [
        {"role": "system", "content": "You are a helpful AI assistant"},
        {"role": "user", "content": "List 3 countries and their capitals."}
    ],
    "temperature": 0,
    "max_completion_tokens": 500
}

response = requests.post(url, headers=headers, json=payload)
print(json.dumps(response.json(), indent=2))
Create a model response
OpenAI's most advanced interface for generating model responses. Supports text and image inputs, and text outputs. Create stateful interactions with the model, using the output of previous responses as input. Extend the model's capabilities with built-in tools for file search, web search, computer use, and more. Allow the model access to external systems and data using function calling.
Default
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "input": "Tell me a three sentence bedtime story about a unicorn."
  }'
Streaming
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "instructions": "You are a helpful assistant.",
    "input": "Hello!",
    "stream": true
  }'
Reasoning
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "input": "How much wood would a woodchuck chuck?",
    "reasoning": {
      "effort": "low"
    }
  }'
Functions
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "input": "What is the weather like in Boston today?",
    "tools": [
      {
        "type": "function",
        "name": "get_current_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "description": "Temperature unit",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location", "unit"]
        }
      }
    ],
    "tool_choice": "auto"
  }'
Image Input
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "what is in this image?"},
          {
            "type": "input_image",
            "image_url": "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg"
          }
        ]
      }
    ]
  }'
File Input
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "what is in this file?"},
          {
            "type": "input_file",
            "file_url": "https://www.berkshirehathaway.com/letters/2024ltr.pdf"
          }
        ]
      }
    ]
  }'
Web search
sh

curl https://api.gmi-serving.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GMI_API_KEY" \
  -d '{
    "model": "openai/gpt-5.2",
    "tools": [{ "type": "web_search_preview" }],
    "input": "What was a positive news story from today?"
  }'
