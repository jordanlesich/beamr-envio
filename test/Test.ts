import assert from "assert";
import { 
  TestHelpers,
  BeamR_Initialized
} from "generated";
const { MockDb, BeamR } = TestHelpers;

describe("BeamR contract Initialized event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for BeamR contract Initialized event
  const event = BeamR.Initialized.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("BeamR_Initialized is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await BeamR.Initialized.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualBeamRInitialized = mockDbUpdated.entities.BeamR_Initialized.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedBeamRInitialized: BeamR_Initialized = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      adminRole: event.params.adminRole,
      rootAdminRole: event.params.rootAdminRole,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualBeamRInitialized, expectedBeamRInitialized, "Actual BeamRInitialized should be the same as the expectedBeamRInitialized");
  });
});
