import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RateMyProfessor } from "rate-my-professor-api-ts-fixed";

async function get_professor(school: string, name: string): Promise<RateMyProfessor | null> {
  try {
    const professor_instance = new RateMyProfessor(school, name);
    console.error(`Instance of professor ${name} successfully created`);
    return professor_instance; 
  } catch (error) {
    console.error(`Something went wrong trying to create instance of professor ${name}:`, error);
    return null;
  }
}

async function get_professor_info(professor: RateMyProfessor): Promise<string | null> {
  try {
    const professor_info = await professor.get_professor_info();
    
    const professor_info_stripped = `The Information available from RateMyProfessor about ${professor.teacherName} in the ${professor_info.department} Department of the ${professor_info.school.name}:
    Number of Ratings received: ${professor_info.numRatings}
    Average Rating for courses(over 5): ${professor_info.avgRating.toFixed(2)}
    Percentage of students that would take a class again with ${professor.teacherName}: ${professor_info.wouldTakeAgainPercent.toFixed(2)}%`;

    return professor_info_stripped;
  } catch (error) {
    console.error(`Something went wrong trying to get the info for ${professor.teacherName}:`, error);
    return null;
  }
}

async function get_professor_comments(professor: RateMyProfessor): Promise<string | null> {
  try {
    const professor_ratings = await professor.get_comments_by_professor();

    let finalString = '';
    if (professor_ratings) {
      for (const r of professor_ratings) {
        finalString += `Class: ${r.class}
        Date Posted: ${r.date_posted}
        Difficulty Rating: ${r.difficulty_rating.toFixed(2)}
        Clarity Rating: ${r.clarity_rating.toFixed(2)}
        Comment Likes: ${r.comment_likes}
        Comment Dislikes: ${r.comment_dislikes}
        Rating Tags: ${r.rating_tags.replaceAll("--", ", ")}
        Comment: ${r.comment}

        ----------------------------
`;
      }
    }

    return finalString;
  } catch (error) {
    console.error(`Something went wrong trying to get the information about comments for ${professor.teacherName}:`, error);
    return null;
  }
}

async function fetch_professor_data(school: string, professorName: string): Promise<{ info: string | null, comments: string | null } | null> {
  try {
    const professor_instance = await get_professor(school, professorName);

    if (professor_instance) { 
      const professor_info = await get_professor_info(professor_instance);
      const professor_comments_info = await get_professor_comments(professor_instance);

      return {
        info: professor_info,
        comments: professor_comments_info
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error creating professor instance and running operations:", error);
    return null;
  }
}

// Create server instance
const server = new McpServer({
  name: "rate-my-prof",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register rate my professor tool
server.tool(
  "get_rate_my_professor_data",
  "Get Rate My Professor information for a professor at a school",
  {
    school: z.string().describe("School name (e.g., 'University of Manitoba')"),
    professor_name: z.string().describe("Professor name (e.g., 'Timothy Zapp')"),
  },
  async ({ school, professor_name }) => {
    try {
      const data = await fetch_professor_data(school, professor_name);

      if (!data || !data.info) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch data for ${professor_name} at ${school}. The professor might not be found in the Rate My Professor database, or there might be an issue with the school name format.`,
            },
          ],
        };
      }

      const combinedText = `${data.info}\n\n--- Professor Comments ---\n${data.comments || "No comments available"}`;

      return {
        content: [
          {
            type: "text",
            text: combinedText,
          },
        ],
      };
    } catch (error) {
      console.error("Error in tool execution:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error occurred while fetching data for ${professor_name} at ${school}: ${error}`,
          },
        ],
      };
    }
  },
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Rate My Professor MCP Server running on stdio");
  }
  
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });