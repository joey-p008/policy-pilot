import { PROPOSE_ACCESS_DECISION_TOOL } from '../tools/propose-access-decision.tool';
import { toLlmExecutionResult, toOpenAiToolChoice, toOpenAiTools } from './map-chat-completion';

describe('map-chat-completion', () => {
  it('maps gated tool definitions to OpenAI function tools without the HITL flag', () => {
    const mapped = toOpenAiTools([PROPOSE_ACCESS_DECISION_TOOL]);

    expect(mapped).toEqual([
      {
        type: 'function',
        function: {
          name: 'propose_access_decision',
          description: PROPOSE_ACCESS_DECISION_TOOL.description,
          parameters: PROPOSE_ACCESS_DECISION_TOOL.parameters,
          strict: true,
        },
      },
    ]);
    expect(JSON.stringify(mapped)).not.toContain('requiresHumanApproval');
  });

  it('maps named tool_choice to an OpenAI function force', () => {
    expect(toOpenAiToolChoice({ name: 'propose_access_decision' })).toEqual({
      type: 'function',
      function: { name: 'propose_access_decision' },
    });
    expect(toOpenAiToolChoice('required')).toBe('required');
  });

  it('uses tool call arguments as content when the assistant message body is empty', () => {
    const argumentsJson = JSON.stringify({ decision: 'ESCALATE' });
    const result = toLlmExecutionResult({
      message: {
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'propose_access_decision',
              arguments: argumentsJson,
            },
          },
        ],
      },
      inputTokens: 10,
      outputTokens: 4,
    });

    expect(result.content).toBe(argumentsJson);
    expect(result.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'propose_access_decision',
        argumentsJson,
      },
    ]);
  });

  it('still throws when both content and tool_calls are empty', () => {
    expect(() =>
      toLlmExecutionResult({
        message: { content: null, tool_calls: [] },
        inputTokens: 1,
        outputTokens: 0,
      }),
    ).toThrow(/empty content/);
  });

  it('keeps json-style content when no tool calls are present', () => {
    const result = toLlmExecutionResult({
      message: { content: '{"decision":"DENY"}' },
      inputTokens: 8,
      outputTokens: 3,
    });

    expect(result.content).toBe('{"decision":"DENY"}');
    expect(result.toolCalls).toEqual([]);
  });
});
