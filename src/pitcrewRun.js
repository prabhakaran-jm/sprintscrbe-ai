import api, { route, storage } from '@forge/api';
import { createHash } from 'crypto';

/**
 * Handler for Rovo Agent action: sprintscrbe-pitcrew-run
 * Creates Jira issues from action items and updates Confluence page with summary
 * @param {Object} req - Request object from Rovo Agent
 * @returns {Promise<Object>} Result object with createdIssueKeys, updatedConfluence, and message
 */
export const run = async (req) => {
  let payload;
  
  // Parse payloadJson safely
  try {
    const { payloadJson } = req.payload;
    if (!payloadJson || typeof payloadJson !== 'string') {
      return {
        createdIssueKeys: [],
        updatedConfluence: false,
        message: 'Error: payloadJson is required and must be a string'
      };
    }
    payload = JSON.parse(payloadJson);
  } catch (parseError) {
    return {
      createdIssueKeys: [],
      updatedConfluence: false,
      message: `Error: Invalid JSON in payloadJson - ${parseError.message}`
    };
  }

  // Validate required fields
  const { jiraProjectKey, confluencePageId, meetingTitle, transcriptText, decisions, actionItems } = payload;
  
  if (!jiraProjectKey) {
    return {
      createdIssueKeys: [],
      updatedConfluence: false,
      message: 'Error: jiraProjectKey is required'
    };
  }

  if (!confluencePageId) {
    return {
      createdIssueKeys: [],
      updatedConfluence: false,
      message: 'Error: confluencePageId is required'
    };
  }

  // Ensure decisions and actionItems are arrays
  const safeDecisions = Array.isArray(decisions) ? decisions : [];
  const safeActionItems = Array.isArray(actionItems) ? actionItems : [];

  // Idempotency check: prevent duplicate processing of the same transcript
  try {
    const storageKey = `sprintscrbe:${confluencePageId}:rovo-processed-hash`;
    const transcriptHash = createHash('md5').update(transcriptText || '').digest('hex');
    const previousHash = await storage.get(storageKey);

    if (previousHash === transcriptHash) {
      return {
        createdIssueKeys: [],
        updatedConfluence: false,
        message: 'This transcript has already been processed. Use "Reset Meeting" in the macro to process again, or modify the transcript to create new issues.'
      };
    }

    // Store the hash after successful processing (will be set at the end)
  } catch (hashError) {
    // If hash check fails, continue anyway (don't block processing)
    console.warn('Idempotency check failed, continuing:', hashError);
  }

  try {
    // Get base URL from context
    const baseUrl = req.context?.extension?.baseUrl || '';
    
    // Step 1: Create Jira issues for each action item
    const createdIssueKeys = [];
    
    for (const item of safeActionItems) {
      if (!item.text || !item.text.trim()) {
        continue; // Skip empty items
      }

      const summary = item.text.substring(0, 120); // Truncate to 120 chars
      
      // Build description with meeting context
      const descriptionParts = [];
      descriptionParts.push(`Meeting: ${meetingTitle || 'Untitled Meeting'}`);
      
      // Add Confluence page link
      const pageUrl = baseUrl ? `${baseUrl}/wiki/spaces/*/pages/${confluencePageId}` : '';
      if (pageUrl) {
        descriptionParts.push(`\n\nSource: ${pageUrl}`);
      }
      
      // Add decisions if available
      if (safeDecisions.length > 0) {
        descriptionParts.push(`\n\nDecisions:\n${safeDecisions.map(d => `• ${d}`).join('\n')}`);
      }
      
      // Add transcript preview (first 40 lines max)
      if (transcriptText) {
        const transcriptLines = transcriptText.split('\n').slice(0, 40).join('\n');
        descriptionParts.push(`\n\nOriginal Transcript (preview):\n${transcriptLines}`);
      }
      
      // Add owner, due date, and confidence if available
      const metadataParts = [];
      if (item.owner) {
        metadataParts.push(`Owner: ${item.owner}`);
      }
      if (item.dueDate) {
        metadataParts.push(`Due Date: ${item.dueDate}`);
      }
      if (item.confidence) {
        metadataParts.push(`Confidence: ${item.confidence}`);
      }
      if (metadataParts.length > 0) {
        descriptionParts.push(`\n\n${metadataParts.join(' | ')}`);
      }

      const description = descriptionParts.join('');

      // Build issue creation payload
      const issuePayload = {
        fields: {
          project: {
            key: jiraProjectKey
          },
          summary: summary.substring(0, 255), // Jira summary max length
          issuetype: {
            name: 'Task'
          },
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: description
                  }
                ]
              }
            ]
          }
        }
      };

      // Add assignee if owner is provided (try to match Jira user)
      if (item.owner) {
        try {
          const userResponse = await api.asUser().requestJira(
            route`/rest/api/3/user/search?query=${encodeURIComponent(item.owner)}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json'
              }
            }
          );

          if (userResponse.ok) {
            const users = await userResponse.json();
            if (users && users.length > 0) {
              issuePayload.fields.assignee = {
                accountId: users[0].accountId
              };
            }
          }
        } catch (userError) {
          // If user lookup fails, continue without assignment
          // Owner name is already in description
          console.error('Failed to find Jira user:', userError);
        }
      }

      // Add due date if provided and valid
      if (item.dueDate && item.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        issuePayload.fields.duedate = item.dueDate;
      }

      // Create the issue
      try {
        const createResponse = await api.asUser().requestJira(route`/rest/api/3/issue`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(issuePayload)
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error(`Failed to create issue: ${createResponse.status} - ${errorText}`);
          continue; // Skip this issue and continue with others
        }

        const createdIssue = await createResponse.json();
        createdIssueKeys.push(createdIssue.key);
      } catch (issueError) {
        console.error('Error creating Jira issue:', issueError);
        // Continue with next issue
      }
    }

    // Step 2: Update Confluence page with summary
    let updatedConfluence = false;
    
    try {
      // Get current page content
      const pageResponse = await api.asUser().requestConfluence(
        route`/wiki/api/v2/pages/${confluencePageId}?body-format=atlas_doc_format`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch page: ${pageResponse.status}`);
      }

      const page = await pageResponse.json();
      const currentBody = page.body?.atlas_doc_format?.value || { type: 'doc', version: 1, content: [] };
      
      // Extract first 3 non-empty lines from transcript for "What was discussed"
      const transcriptLines = transcriptText ? transcriptText.split('\n').filter(line => line.trim()).slice(0, 3) : [];
      
      // Build summary section
      const summarySection = {
        type: 'heading',
        attrs: { level: 2 },
        content: [
          {
            type: 'text',
            text: 'SprintScribe Pit Crew Summary'
          }
        ]
      };

      const whatWasDiscussedSection = {
        type: 'heading',
        attrs: { level: 3 },
        content: [
          {
            type: 'text',
            text: 'What was discussed'
          }
        ]
      };

      const whatWasDiscussedList = {
        type: 'bulletList',
        content: transcriptLines.map(line => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: line.trim()
                }
              ]
            }
          ]
        }))
      };

      const decisionsSection = {
        type: 'heading',
        attrs: { level: 3 },
        content: [
          {
            type: 'text',
            text: 'Decisions'
          }
        ]
      };

      const decisionsList = {
        type: 'bulletList',
        content: safeDecisions.length > 0
          ? safeDecisions.map(decision => ({
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: decision
                    }
                  ]
                }
              ]
            }))
          : [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: 'No decisions recorded',
                        marks: [{ type: 'em' }]
                      }
                    ]
                  }
                ]
              }
            ]
      };

      const actionItemsSection = {
        type: 'heading',
        attrs: { level: 3 },
        content: [
          {
            type: 'text',
            text: 'Action Items'
          }
        ]
      };

      // Build action items list with Jira issue links
      const actionItemsList = {
        type: 'bulletList',
        content: createdIssueKeys.length > 0
          ? createdIssueKeys.map(issueKey => {
              const issueUrl = baseUrl ? `${baseUrl}/browse/${issueKey}` : '';
              const actionItem = safeActionItems.find((item, index) => index < createdIssueKeys.length);
              const actionText = actionItem?.text || issueKey;
              
              return {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: issueUrl
                      ? [
                          {
                            type: 'text',
                            text: actionText,
                            marks: [
                              {
                                type: 'link',
                                attrs: {
                                  href: issueUrl
                                }
                              }
                            ]
                          },
                          {
                            type: 'text',
                            text: ` (${issueKey})`
                          }
                        ]
                      : [
                          {
                            type: 'text',
                            text: `${actionText} (${issueKey})`
                          }
                        ]
                  }
                ]
              };
            })
          : [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: 'No action items created',
                        marks: [{ type: 'em' }]
                      }
                    ]
                  }
                ]
              }
            ]
      };

      // Append summary section to existing content
      const updatedContent = {
        ...currentBody,
        content: [
          ...(currentBody.content || []),
          summarySection,
          whatWasDiscussedSection,
          whatWasDiscussedList,
          decisionsSection,
          decisionsList,
          actionItemsSection,
          actionItemsList
        ]
      };

      // Update the page
      const updateResponse = await api.asUser().requestConfluence(
        route`/wiki/api/v2/pages/${confluencePageId}`,
        {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            version: {
              number: page.version.number + 1
            },
            body: {
              atlas_doc_format: {
                value: updatedContent,
                representation: 'atlas_doc_format'
              }
            }
          })
        }
      );

      if (updateResponse.ok) {
        updatedConfluence = true;
      } else {
        const errorText = await updateResponse.text();
        console.error(`Failed to update Confluence page: ${updateResponse.status} - ${errorText}`);
      }
    } catch (confluenceError) {
      console.error('Error updating Confluence page:', confluenceError);
      // Don't fail the entire operation if Confluence update fails
    }

    // Store hash after successful processing to prevent duplicates
    try {
      const storageKey = `sprintscrbe:${confluencePageId}:rovo-processed-hash`;
      const transcriptHash = createHash('md5').update(transcriptText || '').digest('hex');
      await storage.set(storageKey, transcriptHash);
    } catch (hashError) {
      // Non-critical: if hash storage fails, log but don't fail the operation
      console.warn('Failed to store transcript hash:', hashError);
    }

    // Return success result with richer response
    // baseUrl is already declared at line 77, reuse it here
    return {
      createdIssueKeys,
      createdIssueUrls: createdIssueKeys.map(key => baseUrl ? `${baseUrl}/browse/${key}` : ''),
      updatedConfluence,
      confluencePageUrl: baseUrl ? `${baseUrl}/wiki/spaces/*/pages/${confluencePageId}` : '',
      summary: {
        totalActionItems: safeActionItems.length,
        successfulCreations: createdIssueKeys.length,
        failedCreations: safeActionItems.length - createdIssueKeys.length,
        decisionsRecorded: safeDecisions.length
      },
      message: `✅ Created ${createdIssueKeys.length}/${safeActionItems.length} Jira issue(s)${updatedConfluence ? ' and updated Confluence page' : ' (Confluence update failed)'}`
    };
  } catch (error) {
    console.error('Error in pitcrewRun:', error);
    return {
      createdIssueKeys: [],
      updatedConfluence: false,
      message: `Error: ${error.message}`
    };
  }
};

